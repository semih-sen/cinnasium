import { IsString, IsNotEmpty, MaxLength, IsOptional, IsUUID, IsInt, Min, IsEnum } from 'class-validator';
import { UserRole } from '../../user/entities/user.entity';

export class CategoryForCreateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  iconUrl?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string; // Üst kategori ID'si (opsiyonel)

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number = 0; // Varsayılan değer

  // İzinler için varsayılanlar entity'de, ama DTO ile override edilebilir
  @IsOptional() @IsEnum(UserRole) minViewRole?: UserRole;
  @IsOptional() @IsEnum(UserRole) minThreadRole?: UserRole;
  @IsOptional() @IsEnum(UserRole) minPostRole?: UserRole;
}