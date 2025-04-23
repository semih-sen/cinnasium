import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    OneToMany,
    JoinColumn,
    Index,
  } from 'typeorm';
  import { Thread } from '../../thread/entities/thread.entity';
  import { User } from '../../user/entities/user.entity';
  import { PostVote } from './post-vote.entity'; // Oylama için (aşağıda tanımlanacak)
  import { PostComment } from './post-comment.entity'; // Yorum için (aşağıda tanımlanacak)
  
  @Entity('posts')
  export class Post {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @Column({ type: 'text', nullable: false }) // Mesaj içeriği boş olamaz
    content: string;
  
    // --- İlişkiler ---
    @ManyToOne(() => Thread, (thread) => thread.posts, {
      nullable: false, // Her mesaj bir konuya ait olmalı
      onDelete: 'CASCADE', // Konu silinirse mesajlar da silinsin
      lazy: true,
    })
    @JoinColumn({ name: 'threadId' })
    thread: Thread;
  
    @Index() // Konuya göre mesajları hızlı çekmek için
    @Column({ type: 'uuid', nullable: false })
    threadId: string;
  
    @ManyToOne(() => User, /* user => user.posts */ {
      nullable: true, // Yazar silinebilir
      onDelete: 'SET NULL', // Yazar silinirse null olur
      eager: true, // Mesajla birlikte yazar bilgisi genelde istenir
    })
    @JoinColumn({ name: 'authorId' })
    author: User | null;
  
    @Index() // Yazara göre mesajları hızlı çekmek için
    @Column({ type: 'uuid', nullable: true })
    authorId: string | null;
  
    // --- Alıntı/Cevap İlişkisi ---
    @ManyToOne(() => Post, (post) => post.replies, {
      nullable: true, // İlk mesajların parent'ı olmaz
      onDelete: 'SET NULL', // Cevap verilen mesaj silinirse bağlantı kopar (null olur)
      lazy: true,
    })
    @JoinColumn({ name: 'parentPostId' })
    parentPost?: Post | null; // Hangi mesaja cevap verildiği
  
    @Column({ type: 'uuid', nullable: true })
    parentPostId?: string | null;
  
    @OneToMany(() => Post, (post) => post.parentPost, { lazy: true })
    replies: Post[]; // Bu mesaja verilen cevaplar
  
    // --- Oylama (Upvote/Downvote) ---
    // Asıl oyları ayrı bir tabloda (PostVote) tutacağız.
    @OneToMany(() => PostVote, (vote) => vote.post, { cascade: ['insert'] }) // Oyları post ile ilişkilendir
    votes: PostVote[];
  
    // Performans için denormalize edilmiş oy sayıları
    @Index() // Oylamaya göre sıralama için index
    @Column({ type: 'int', default: 0 })
    upvotes: number;
  
    @Column({ type: 'int', default: 0 })
    downvotes: number;
  
    // Net skoru da tutabiliriz: upvotes - downvotes
    @Index() // Skora göre sıralama için index
    @Column({ type: 'int', default: 0 })
    score: number;
  
    // --- Mesaja Yorumlar ---
    @OneToMany(() => PostComment, (comment) => comment.post, { cascade: ['insert'] })
    comments: PostComment[];
  
    @Column({ type: 'int', default: 0 })
    commentCount: number; // Denormalize yorum sayısı
  
    // --- Diğer Alanlar ---
    @Column({ type: 'inet', nullable: true, select: false }) // PostgreSQL'in IP adresi türü, sorgularda gelmesin
    ipAddress?: string;
  
    @Column({ type: 'boolean', default: false })
    isEdited: boolean; // Mesaj düzenlendi mi? (Basit flag)
  
    @Index() // Başlangıç postunu hızlı bulmak için index
    @Column({ type: 'boolean', default: false })
    isThreadStarter: boolean; // Bu mesaj konuyu başlatan mesaj mı?
  
    // --- Zaman Damgaları ---
    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;
  
    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt: Date;
  
    // Not: Oy/Yorum sayıları veya skor güncellendiğinde updatedAt otomatik güncellenir.
    // Bu sayıları güncellemek için Listener/Subscriber veya Service katmanı mantığı gerekir.
  }