import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CommentForCreateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000) // Yorumlar için makul bir sınır
  content: string;
}