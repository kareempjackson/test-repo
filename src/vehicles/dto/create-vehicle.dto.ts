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

export class CreateVehicleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  make: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  model: string;

  @IsNumber()
  @Type(() => Number)
  @Min(1900)
  @Max(new Date().getFullYear() + 1)
  year: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Type(() => Number)
  @Min(1)
  @Max(100000)
  dailyRate: number;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  location: string;

  @IsOptional()
  @IsObject()
  specs?: Record<string, unknown>;
}
