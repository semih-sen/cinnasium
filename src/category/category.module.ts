import { Module } from '@nestjs/common';
import { CategoryService } from './category.service';
import { CategoryController } from './category.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { Category } from './entities/category.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Category]), // Category Repository'sini sağlar
    AuthModule, // Guards içinde JWT ve Rol kontrolü için
  ],
  controllers: [CategoryController],
  providers: [CategoryService],
  exports: [CategoryService], 
})
export class CategoryModule {}
