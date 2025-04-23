import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, TreeRepository } from 'typeorm'; // TreeRepository'yi de alalım
import { Category } from './entities/category.entity';
import { CategoryForCreateDto } from './dtos/category_for_create.dto';
import { CategoryForUpdateDto } from './dtos/category_for_update.dto';

@Injectable()
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name);

  constructor(
    // Normal Repository'yi de inject edebiliriz, TreeRepository bunun alt sınıfı
    @InjectRepository(Category)
    private readonly categoryRepository: TreeRepository<Category>, // Tree metotları için TreeRepository
  ) {}

  async create(createCategoryDto: CategoryForCreateDto): Promise<Category> {
    const { parentId, ...categoryData } = createCategoryDto;
    const category = this.categoryRepository.create(categoryData);

    if (parentId) {
      const parent = await this.categoryRepository.findOne({ where: { id: parentId } });
      if (!parent) {
        this.logger.warn(`Parent category with ID ${parentId} not found.`);
        throw new NotFoundException(`Parent category with ID ${parentId} not found`);
      }
      category.parent = parent;
    }

    try {
      const savedCategory = await this.categoryRepository.save(category);
      this.logger.log(`Category created successfully with ID: ${savedCategory.id}`);
      return savedCategory;
    } catch (error) {
        // Özellikle unique slug constraint hatasını yakalamak önemli olabilir
        this.logger.error('Failed to create category', error);
        if (error.code === '23505') { // PostgreSQL unique violation
             throw new BadRequestException('Category name or slug might already exist.');
        }
        throw error; // Diğer hataları tekrar fırlat
    }
  }

  /**
   * Tüm kategori ağacını getirir.
   */
  async findAllTree(): Promise<Category[]> {
    this.logger.log('Fetching category tree.');
    // findTrees, tüm kategorileri hiyerarşik (nested children) olarak getirir
    return this.categoryRepository.findTrees();
  }

  /**
   * ID veya Slug ile tek bir kategori getirir.
   */
  async findOne(idOrSlug: string): Promise<Category> {
     this.logger.log(`Finding category by id or slug: ${idOrSlug}`);
     let category: Category | null = null;

     // UUID formatına benziyorsa ID ile ara, değilse slug ile
     const isUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(idOrSlug);

     if (isUUID) {
         category = await this.categoryRepository.findOne({ where: { id: idOrSlug } });
     } else {
         category = await this.categoryRepository.findOne({ where: { slug: idOrSlug } });
     }

     if (!category) {
       this.logger.warn(`Category not found: ${idOrSlug}`);
       throw new NotFoundException(`Category with identifier ${idOrSlug} not found`);
     }
     return category;
  }

  /**
   * Bir kategorinin alt ağacını (kendisi ve tüm alt kategorileri) getirir.
   */
  async findDescendantsTree(category: Category): Promise<Category> {
     this.logger.log(`Finding descendants tree for category ID: ${category.id}`);
     return this.categoryRepository.findDescendantsTree(category);
  }

  /**
   * Bir kategorinin üst ağacını (kendisi ve tüm ebeveynleri) getirir.
   */
   async findAncestorsTree(category: Category): Promise<Category> {
     this.logger.log(`Finding ancestors tree for category ID: ${category.id}`);
     return this.categoryRepository.findAncestorsTree(category);
   }

  async update(id: string, updateCategoryDto: CategoryForUpdateDto): Promise<Category> {
    this.logger.log(`Attempting to update category ID: ${id}`);
    const { parentId, ...updateData } = updateCategoryDto;

    // preload kullanmak yerine önce findOne ile bulalım ki TreeParent güncellemesini handle edebilelim.
    const category = await this.findOne(id); // findOne zaten NotFoundException fırlatır

    // Gelen DTO'daki verileri mevcut kategori üzerine uygula
    this.categoryRepository.merge(category, updateData);

    // Parent ID değişikliği varsa
    if (parentId !== undefined) { // parentId DTO'da belirtilmişse (null dahil)
      if (parentId === null) { // Ana kategori yapılıyor
          category.parent = null;
      } else {
           if (parentId === category.id) { // Kendini parent yapamaz
                throw new BadRequestException('A category cannot be its own parent.');
           }
           const newParent = await this.categoryRepository.findOne({ where: { id: parentId } });
           if (!newParent) {
                throw new NotFoundException(`New parent category with ID ${parentId} not found`);
           }
            // Döngüsel ilişki kontrolü (yeni parent, mevcut kategorinin alt kategorisi olamaz)
            // Bu kontrol TreeRepository metotlarıyla daha sağlam yapılabilir ama basit bir kontrol ekleyelim:
           const descendants = await this.categoryRepository.findDescendants(category);
           if (descendants.some(desc => desc.id === newParent.id)) {
                throw new BadRequestException('Cannot move category under one of its own descendants.');
           }
           category.parent = newParent;
      }
    }

    try {
      // Slug'ın güncellenmesi için BeforeUpdate listener'ı çalışacaktır.
      const updatedCategory = await this.categoryRepository.save(category);
      this.logger.log(`Category updated successfully: ${updatedCategory.id}`);
      return updatedCategory;
    } catch (error) {
      this.logger.error(`Failed to update category ID: ${id}`, error);
       if (error.code === '23505') { // PostgreSQL unique violation (slug)
             throw new BadRequestException('Category name or slug might already exist.');
        }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    this.logger.log(`Attempting to remove category ID: ${id}`);
    const category = await this.findOne(id); // Bulamazsa NotFoundException fırlatır

    // Önemli Not: @TreeParent({ onDelete: 'SET NULL' }) ayarı sayesinde,
    // bu kategori silindiğinde alt kategorilerinin parent ilişkisi otomatik null olur.
    // Eğer @OneToMany(() => Thread, ...) ilişkisinde onDelete: 'CASCADE' varsa,
    // bu kategoriye ait Thread'ler de otomatik silinir. 'SET NULL' ise thread'lerin categoryId'si null olur.
    // Bu davranışları entity tanımlarında kontrol etmelisin!

    try {
      await this.categoryRepository.remove(category);
      this.logger.log(`Category removed successfully: ${id}`);
    } catch (error) {
        this.logger.error(`Failed to remove category ID: ${id}`, error);
        throw error;
    }
  }

  // İstatistik Güncelleme Metotları (Örnek - Listener/Subscriber ile yapmak daha iyi)
  // Bu metotlar ThreadService/PostService tarafından çağrılabilir veya Listener ile tetiklenebilir.
  async incrementThreadCount(categoryId: string) {
    await this.categoryRepository.increment({ id: categoryId }, 'threadCount', 1);
    this.logger.debug(`Incremented thread count for category ${categoryId}`);
  }

  async decrementThreadCount(categoryId: string) {
    await this.categoryRepository.decrement({ id: categoryId }, 'threadCount', 1);
     this.logger.debug(`Decremented thread count for category ${categoryId}`);
  }

  async incrementPostCount(categoryId: string, amount: number = 1) {
      await this.categoryRepository.increment({ id: categoryId }, 'postCount', amount);
      this.logger.debug(`Incremented post count by ${amount} for category ${categoryId}`);
  }

   async decrementPostCount(categoryId: string, amount: number = 1) {
       await this.categoryRepository.decrement({ id: categoryId }, 'postCount', amount);
        this.logger.debug(`Decremented post count by ${amount} for category ${categoryId}`);
   }
}