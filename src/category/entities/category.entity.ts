import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    Index,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
    Tree, // Tree decorator'ı
    TreeChildren, // Alt öğeleri işaretlemek için
    TreeParent, // Üst öğeyi işaretlemek için
    BeforeInsert,
    BeforeUpdate,
  } from 'typeorm';
  import { Thread } from '../../thread/entities/thread.entity';
  import { UserRole } from '../../user/entities/user.entity';
  import slugify from 'slugify';
  
  @Entity('categories')
  @Tree('closure-table') // Hiyerarşi stratejisi: Closure Table
  export class Category {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @Index()
    @Column({ type: 'varchar', length: 100, nullable: false })
    name: string;
  
    @Index({ unique: true })
    @Column({ type: 'varchar', length: 120, unique: true, nullable: false })
    slug: string;
  
    @Column({ type: 'text', nullable: true })
    description?: string;
  
    @Column({ type: 'varchar', length: 255, nullable: true })
    iconUrl?: string;
  
    @Column({ type: 'int', default: 0 })
    displayOrder: number;
  
    // --- Hiyerarşi (TypeORM Tree Kullanımı) ---
    @TreeChildren({ cascade: false }) // Bu kategorinin alt kategorileri
    children: Category[]; // TypeORM bu ilişkiyi closure tablosu üzerinden yönetecek
  
    @TreeParent({ onDelete: 'SET NULL' }) // Bu kategorinin ebeveyni
    parent: Category | null; // Ebeveyn silinirse null olacak (ana kategori olacak)
    // parentId kolonu genellikle TypeORM tarafından otomatik yönetilir,
    // ama Tree yapısında closure tablosu esas alınır.
  
    // --- İlişkiler ---
    @OneToMany(() => Thread, (thread) => thread.category, { lazy: true })
    threads: Thread[];
  
    // --- İstatistikler (Denormalized) ---
    @Column({ type: 'int', default: 0 })
    threadCount: number;
  
    @Column({ type: 'int', default: 0 })
    postCount: number;
  
    // --- Erişim İzinleri (Basit Yaklaşım) ---
    @Column({ type: 'enum', enum: UserRole, default: UserRole.GUEST })
    minViewRole: UserRole;
  
    @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
    minThreadRole: UserRole;
  
    @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
    minPostRole: UserRole;
  
    // --- Zaman Damgaları ---
    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;
  
    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt: Date;
  
    // --- Lifecycle Callbacks ---
    @BeforeInsert()
    @BeforeUpdate()
    generateSlug() {
      if (this.name) {
        this.slug = slugify(this.name, { lower: true, strict: true, remove: /[*+~.()'"!:@]/g });
      }
    }
  
    // Tree yapıları için ek helper alanlar olabilir ama TypeORM bunları genellikle otomatik yönetir.
    // Repository'de findTrees, findDescendantsTree, findAncestorsTree gibi metotlar kullanılabilir.
  }