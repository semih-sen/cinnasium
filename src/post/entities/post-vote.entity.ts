import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    Unique, // Bir kullanıcı bir posta sadece bir oy verebilir
  } from 'typeorm';
  import { User } from '../../user/entities/user.entity';
  import { Post } from './post.entity';
  
  @Entity('post_votes')
  @Unique(['userId', 'postId']) // userId ve postId kombinasyonu eşsiz olmalı
  export class PostVote {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' }) // Oy veren silinirse oyu da silinsin
    @JoinColumn({ name: 'userId' })
    user: User;
  
    @Column({ type: 'uuid', nullable: false })
    userId: string;
  
    @ManyToOne(() => Post, (post) => post.votes, { nullable: false, onDelete: 'CASCADE' }) // Post silinirse oylar da silinsin
    @JoinColumn({ name: 'postId' })
    post: Post;
  
    @Column({ type: 'uuid', nullable: false })
    postId: string;
  
    // Oy değeri: +1 (upvote), -1 (downvote)
    @Column({ type: 'smallint', nullable: false }) // +1 veya -1 için smallint yeterli
    value: number;
  
    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;
  }