import {
  IsString,
  IsNumber,
  IsOptional,
  IsObject,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateVehicleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  make?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  model?: string;

  @IsOptional()
  @IsNumber()
  @Min(1900)
  @Max(new Date().getFullYear() + 1)
  @Type(() => Number)
  year?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  dailyRate?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  location?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(-90)
  @Max(90)
  @Type(() => Number)
  latitude?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(-180)
  @Max(180)
  @Type(() => Number)
  longitude?: number;

  @IsOptional()
  @IsObject()
  specs?: Record<string, unknown>;
}
