import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    Index,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    OneToMany,
    JoinColumn,
    BeforeInsert,
    BeforeUpdate,
    RelationId, // Foreign key ID'sini kolayca almak için
  } from 'typeorm';
  import { Category } from '../../category/entities/category.entity'; // Category entity'si
  import { User } from '../../user/entities/user.entity'; // User entity'si
  import { Post } from '../../post/entities/post.entity'; // Post entity'si (ileride oluşturulacak)
  import slugify from 'slugify';
  
  @Entity('threads')
  export class Thread {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @Column({ type: 'varchar', length: 255, nullable: false })
    title: string;
  
    @Index({ unique: true })
    @Column({ type: 'varchar', length: 280, unique: true, nullable: false })
    slug: string;
  
    // --- İlişkiler ---
    @ManyToOne(() => Category, (category) => category.threads, {
      nullable: false, // Her konu bir kategoriye ait olmalı
      onDelete: 'CASCADE', // Kategori silinirse ilişkili konular da silinsin (veya 'SET NULL' olabilir)
      lazy: true,
    })
    @JoinColumn({ name: 'categoryId' }) // Foreign key kolon adını belirtmek iyi pratiktir
    category: Category;
  
    @Column({ type: 'uuid', nullable: false }) // İlişki için foreign key sütunu
    categoryId: string;
  
    @ManyToOne(() => User, /* user => user.threads (User entity'sinde bu ilişkiyi tanımlamak lazım) */ {
      nullable: true, // Yazar silinirse konu kalabilir (nullable: true)
      onDelete: 'SET NULL', // Yazar silinirse authorId null olur
      eager: true, // Konu yüklenirken yazar bilgisi genelde istenir, eager olabilir
    })
    @JoinColumn({ name: 'authorId' })
    author: User | null; // Yazar null olabilir
  
    @Column({ type: 'uuid', nullable: true }) // Yazar null olabileceği için nullable: true
    authorId: string | null;
  
    // Konunun mesajları (ilk mesaj dahil)
    @OneToMany(() => Post, (post) => post.thread, {
      cascade: ['insert'], // Yeni konu ile birlikte ilk mesaj da kaydedilebilir
      lazy: true,
    })
    posts: Post[];
  
    // --- Durumlar ---
    @Column({ type: 'boolean', default: false })
    isLocked: boolean; // Kilitli mi?
  
    @Column({ type: 'boolean', default: false })
    isPinned: boolean; // Sabitlenmiş mi?
  
    // --- İstatistikler ---
    @Column({ type: 'int', default: 0 })
    viewCount: number; // Görüntülenme sayısı (Servis katmanında artırılmalı)
  
    @Column({ type: 'int', default: 0 })
    replyCount: number; // Cevap sayısı (İlk mesaj hariç post sayısı. Listener/Service ile güncellenmeli)
  
    // --- Son Mesaj Bilgisi (Denormalized - Performans için) ---
    // Listelemelerde son aktiviteye göre sıralama için çok kullanışlıdır
    @ManyToOne(() => Post, { nullable: true, onDelete: 'SET NULL', lazy: true })
    @JoinColumn({ name: 'lastPostId' })
    lastPost?: Post | null; // Son mesajın kendisi (opsiyonel)
  
    @Column({ type: 'uuid', nullable: true }) // Son mesajın ID'si
    lastPostId?: string | null;
  
    // Son mesajı gönderen kullanıcı (hızlı erişim için)
     @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL', lazy: true })
     @JoinColumn({ name: 'lastPostById' })
     lastPostBy?: User | null;
  
     @Column({ type: 'uuid', nullable: true })
     lastPostById?: string | null; // Son mesajı yazanın ID'si
  
    @Column({ type: 'timestamptz', nullable: true })
    lastPostAt?: Date | null; // Son mesajın gönderilme zamanı
  
    // --- Zaman Damgaları ---
    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;
  
    // Bu updatedAt, replyCount veya viewCount değiştiğinde de güncellenebilir.
    // Sıralama için genellikle lastPostAt daha anlamlıdır.
    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt: Date;
  
    // --- Lifecycle Callbacks ---
    @BeforeInsert()
    @BeforeUpdate()
    generateSlug() {
      if (this.title) {
          // ID'yi de slug'a eklemek eşsizliği garantilemeye yardımcı olabilir (özellikle aynı başlıklar varsa)
          // Ama ID henüz oluşmadığı için BeforeInsert'te bu zor. Şimdilik sadece title'dan üretelim.
          // Eşsizlik ihlali olursa service katmanında veya listener'da handle etmek gerekebilir (örn: sonuna rastgele karakter ekleme)
        this.slug = slugify(this.title, {
          lower: true,
          strict: true,
           remove: /[*+~.()'"!:@]/g
        });
        // Slug'ın çok uzamasını engellemek için kırpma eklenebilir:
        // this.slug = this.slug.substring(0, 270); // Max uzunluk - biraz pay bırakalım
      }
    }
  }