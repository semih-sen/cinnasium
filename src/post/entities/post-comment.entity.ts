import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
  } from 'typeorm';
  import { User } from '../../user/entities/user.entity';
  import { Post } from './post.entity';
  
  @Entity('post_comments')
  export class PostComment {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @Column({ type: 'text', nullable: false })
    content: string;
  
    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' }) // Yazar silinirse yorum kalsın
    @JoinColumn({ name: 'authorId' })
    author: User | null;
  
    @Column({ type: 'uuid', nullable: true })
    authorId: string | null;
  
    @ManyToOne(() => Post, (post) => post.comments, { nullable: false, onDelete: 'CASCADE' }) // Post silinirse yorumlar da silinsin
    @JoinColumn({ name: 'postId' })
    post: Post;
  
    @Column({ type: 'uuid', nullable: false })
    postId: string;
  
    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;
  
    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt: Date;
  }