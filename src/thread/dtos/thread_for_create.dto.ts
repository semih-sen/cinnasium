import { IsNotEmpty, IsString, MaxLength, MinLength, IsUUID } from 'class-validator';

export class ThreadForCreateDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(5, { message: 'Title must be at least 5 characters long' })
  @MaxLength(255)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10, { message: 'Content must be at least 10 characters long' })
  content: string; // Konunun ilk mesajının içeriği

  @IsUUID()
  @IsNotEmpty()
  categoryId: string; // Hangi kategoriye ait olduğu
}