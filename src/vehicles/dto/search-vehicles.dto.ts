import { IsOptional, IsDateString, IsString, IsNumber, IsEnum, Min, Max, IsInt } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export enum TransmissionType {
  AUTO = 'auto',
  MANUAL = 'manual',
}

export enum SortBy {
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
  RATING_DESC = 'rating_desc',
  NEWEST = 'newest',
}

export class SearchVehiclesDto {
  @IsDateString()
  start_date: string;

  @IsDateString()
  end_date: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  min_price?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  max_price?: number;

  @IsOptional()
  @IsEnum(TransmissionType)
  transmission?: TransmissionType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  min_seats?: number;

  @IsOptional()
  @IsEnum(SortBy)
  sort_by?: SortBy = SortBy.NEWEST;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;
}
