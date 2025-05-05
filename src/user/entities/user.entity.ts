import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index, // Index eklemek için import
    // OneToMany, // İlişkiler için (Örn: Kullanıcının gönderileri)
  } from 'typeorm';
  // import { Post } from './post.entity'; // Örnek ilişki için
  
  // Kullanıcı Rolleri için Enum (İsteğe bağlı ama önerilir)
  export enum UserRole {
    ADMIN = 'admin',
    MODERATOR = 'moderator',
    USER = 'user',
    GUEST = 'guest', // Misafir rolü de olabilir
  }
  
  // Kullanıcı Durumu için Enum (İsteğe bağlı ama önerilir)
  export enum UserStatus {
    ACTIVE = 'active', // Aktif
    PENDING_VERIFICATION = 'pending_verification', // Doğrulama bekliyor
    SUSPENDED = 'suspended', // Askıya alınmış
    BANNED = 'banned', // Yasaklanmış
  }
  
  @Entity('users') // PostgreSQL'deki tablo adı 'users' olacak
  export class User {
    @PrimaryGeneratedColumn('uuid') // Otomatik artan integer yerine UUID kullanmak genellikle daha iyidir.
    id: string;
  
    @Index({ unique: true }) // Kullanıcı adı eşsiz olmalı ve hızlı arama için indexlenmeli
    @Column({ type: 'varchar', length: 50, unique: true, nullable: false })
    username: string;
  
    @Index({ unique: true }) // Email de eşsiz olmalı ve indexlenmeli
    @Column({ type: 'varchar', length: 255, unique: true, nullable: false })
    email: string;
  
    @Column({ type: 'varchar', length: 255, nullable: false, select: false }) // Parola hash'lenmiş olarak saklanmalı ve sorgularda otomatik gelmemeli (select: false)
    passwordHash: string; // Direkt 'password' yerine 'passwordHash' demek daha doğru
  
    @Column({
      type: 'enum',
      enum: UserRole,
      default: UserRole.USER, // Varsayılan rol 'user'
    })
    role: UserRole;
  
    @Column({
      type: 'enum',
      enum: UserStatus,
      default: UserStatus.PENDING_VERIFICATION, // Yeni üye varsayılan olarak doğrulamayı bekleyebilir
    })
    status: UserStatus;
  
    @Column({ type: 'varchar', length: 255, nullable: true }) // Profil resmi URL'i (opsiyonel)
    avatarUrl?: string;
    
    @Column({ type: 'varchar', length: 100, nullable: true }) // Lokasyon (opsiyonel)
    location?: string;
  
    @Column({ type: 'varchar', length: 100, nullable: true }) // İmza (opsiyonel)
    signature?: string;

    @Column({ type: 'timestamptz', nullable: true }) // Son giriş tarihi (timezone ile birlikte)
    lastLoginAt?: Date;
  
    @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' }) // Kayıt tarihi (timezone ile birlikte)
    createdAt: Date;
  
    @UpdateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' }) // Son güncelleme tarihi (timezone ile birlikte)
    updatedAt: Date;
  
    // --- İlişkiler (Örnek) ---
    // Bu kullanıcının sahip olduğu gönderilerle bire-çok ilişki
    // @OneToMany(() => Post, (post) => post.author)
    // posts: Post[];
  
    // --- Ek Metotlar (İsteğe bağlı) ---
    // Örneğin parola kontrolü için bir metot eklenebilir, ama bu genellikle Service katmanında yapılır.
  } 