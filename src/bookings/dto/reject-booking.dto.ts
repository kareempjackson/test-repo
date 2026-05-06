import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectBookingDto {
  @ApiProperty({ required: false, description: 'Optional reason for rejection' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
