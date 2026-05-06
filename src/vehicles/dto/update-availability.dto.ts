import {
  IsArray,
  ValidateNested,
  IsDateString,
  IsBoolean,
  IsOptional,
  IsNumber,
  Min,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AvailabilityDateDto {
  @IsDateString()
  date: string;

  @IsBoolean()
  isAvailable: boolean;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  price?: number;
}

export class UpdateAvailabilityDto {
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(90)
  @Type(() => AvailabilityDateDto)
  dates: AvailabilityDateDto[];
}
