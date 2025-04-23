import { PartialType } from '@nestjs/mapped-types';
import { IsString, MaxLength, MinLength, IsBoolean, IsOptional } from 'class-validator';

// CreateThreadDto'dan title'ı alıp, diğerlerini manuel ekleyelim
// veya sadece güncellenebilir alanları içeren ayrı bir DTO yapalım.
export class ThreadForBaseUpdateDto {
    @IsOptional()
    @IsString()
    @MinLength(5)
    @MaxLength(255)
    title?: string;

    @IsOptional()
    @IsBoolean()
    isLocked?: boolean;

    @IsOptional()
    @IsBoolean()
    isPinned?: boolean;
}

// Kategori taşıma gibi işlemler daha farklı yetki ve mantık gerektirebilir,
// onu ayrı bir DTO/endpoint ile yapmak daha iyi olabilir.
// export class UpdateThreadDto extends PartialType(BaseUpdateThreadDto) {} // PartialType ile hepsi opsiyonel olur.
export class ThreadForUpdateDto extends ThreadForBaseUpdateDto {} // Zaten hepsi optional tanımlandı.