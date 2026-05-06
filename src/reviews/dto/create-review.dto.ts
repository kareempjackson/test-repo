import { IsInt, IsString, Min, Max, MinLength } from 'class-validator';

export class CreateReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @MinLength(20, { message: 'Comment must be at least 20 characters long' })
  comment: string;
}
