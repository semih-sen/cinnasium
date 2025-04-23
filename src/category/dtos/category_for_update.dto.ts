import { PartialType } from '@nestjs/mapped-types'; // DTO'ları inherit etmek için
import { CategoryForCreateDto } from './category_for_create.dto';
import { IsOptional, IsUUID } from 'class-validator';

export class CategoryForUpdateDto extends PartialType(CategoryForCreateDto) {
  // parentId güncellemesini ayrı ele almak gerekebilir (ağacı değiştirmek)
  // Şimdilik PartialType yeterli gibi.
  // Parent değiştirmek için özel bir endpoint/metot daha mantıklı olabilir.
  /*@IsOptional()
  @IsUUID()
  parentId?: string | null; // Null yaparak ana kategori yapma imkanı*/
}