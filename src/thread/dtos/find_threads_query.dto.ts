import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class FindThreadsQueryDto {
  @IsOptional()
  @Type(() => Number) // Query parametreleri string gelir, number'a çevirir
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100) // Sayfa başına çok fazla yüklenmesini engelle
  limit?: number = 15; // Varsayılan limit

  // İleride sort (sıralama) parametreleri de eklenebilir
  // @IsOptional() @IsString() @IsIn(['lastPostAt', 'createdAt', 'title']) sortBy?: string;
  // @IsOptional() @IsString() @IsIn(['ASC', 'DESC']) sortOrder?: string;
}