import { IsEnum, IsInt, IsString, Max, Min, MinLength } from 'class-validator';

export enum ReviewType {
  VEHICLE_REVIEW = 'vehicle_review',
  RENTER_REVIEW = 'renter_review',
}

export class CreateReviewDto {
  @IsEnum(ReviewType)
  type: ReviewType;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @MinLength(20, { message: 'Comment must be at least 20 characters long' })
  comment: string;
}
