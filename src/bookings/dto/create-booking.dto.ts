import { IsUUID, IsDateString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBookingDto {
  @ApiProperty({ description: 'UUID of the vehicle to book' })
  @IsUUID()
  @IsNotEmpty()
  vehicleId: string;

  @ApiProperty({ description: 'Start date of the booking (YYYY-MM-DD)', example: '2024-02-01' })
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({ description: 'End date of the booking (YYYY-MM-DD)', example: '2024-02-05' })
  @IsDateString()
  @IsNotEmpty()
  endDate: string;
}
