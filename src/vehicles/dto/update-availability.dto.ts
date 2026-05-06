import { Type } from 'class-transformer';
import {
  IsArray,
  ValidateNested,
  IsDateString,
  IsBoolean,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';

export class AvailabilityEntryDto {
  @IsDateString()
  date: string;

  @IsBoolean()
  isAvailable: boolean;
}

export class UpdateAvailabilityDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilityEntryDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(90)
  dates: AvailabilityEntryDto[];
}
