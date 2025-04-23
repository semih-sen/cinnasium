import { IsNotEmpty, IsString, MinLength, IsOptional, IsUUID } from 'class-validator';

export class PostForCreateDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1, { message: 'Post content cannot be empty' }) // Min 1 karakter olsun
  content: string;

  @IsOptional()
  @IsUUID()
  parentPostId?: string; // Cevap yazılıyorsa, hangi mesaja cevap olduğu (opsiyonel)
}