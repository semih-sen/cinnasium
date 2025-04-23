import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    HttpCode,
    HttpStatus,
    ParseUUIDPipe, // ID validasyonu için
    Query, // Query parametreleri için
    Logger
  } from '@nestjs/common';
  import { CategoryService } from './category.service';
  import { CategoryForCreateDto } from './dtos/category_for_create.dto';
  import { CategoryForUpdateDto } from './dtos/category_for_update.dto';
  import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // Global Guard kullanılmıyorsa
  import { RolesGuard } from '../auth/guards/roles.guard'; // Rol bazlı guard
  import { Roles } from '../auth/decorators/roles.decorator'; // Rol decorator'ı
  import { UserRole } from '../user/entities/user.entity';
  import { Public } from '../auth/decorators/public.decorator'; // Public decorator
  
  @Controller('category') // Bütün endpointler /category altında
  export class CategoryController {
    private readonly logger = new Logger(CategoryController.name);
  
    constructor(private readonly categoriesService: CategoryService) {}
  
    // Yeni kategori oluşturma (Sadece Admin yetkisi)
    @Post("create")
    @UseGuards(RolesGuard) // Önce JWT kontrolü, sonra Rol kontrolü
    @Roles(UserRole.ADMIN) // Sadece Admin oluşturabilir
    @HttpCode(HttpStatus.CREATED)
    create(@Body() createCategoryDto: CategoryForCreateDto) {
      this.logger.log('Request received to create category');
      return this.categoriesService.create(createCategoryDto);
    }
  
    // Tüm kategori ağacını listeleme (Public)
    @Public() // Global JWT Guard varsa bu decorator gerekli
    @Get('tree') // /categories/tree adresinden erişilir
    findAllTree() {
      this.logger.log('Request received to get category tree');
      return this.categoriesService.findAllTree();
    }
  
    // Belirli bir kategoriyi ID veya Slug ile getirme (Public)
    @Public()
    @Get(':idOrSlug')
    findOne(@Param('idOrSlug') idOrSlug: string) {
       this.logger.log(`Request received to find category: ${idOrSlug}`);
      return this.categoriesService.findOne(idOrSlug);
    }
  
    // Kategori güncelleme (Sadece Admin yetkisi)
    @Patch(':id')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    update(
      @Param('id', ParseUUIDPipe) id: string, // ID'nin UUID formatında olmasını zorunlu kıl
      @Body() updateCategoryDto: CategoryForUpdateDto,
      ) {
       this.logger.log(`Request received to update category ID: ${id}`);
      return this.categoriesService.update(id, updateCategoryDto);
    }
  
    // Kategori silme (Sadece Admin yetkisi)
    @Delete(':id')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    @HttpCode(HttpStatus.NO_CONTENT) // Başarılı silmede 204 No Content döner
    remove(@Param('id', ParseUUIDPipe) id: string) {
       this.logger.log(`Request received to remove category ID: ${id}`);
      return this.categoriesService.remove(id);
    }
  }