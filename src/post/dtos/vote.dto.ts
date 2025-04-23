import { IsIn, IsInt, IsNotEmpty } from 'class-validator';

export class VoteDto {
  @IsNotEmpty()
  @IsInt()
  @IsIn([1, -1], { message: 'Value must be 1 (upvote) or -1 (downvote)' })
  value: 1 | -1; // Sadece 1 veya -1 olabilir
}