import { ApiProperty } from '@nestjs/swagger';
import { BookingStatus } from '@prisma/client';

export class BookingResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  vehicleId: string;

  @ApiProperty()
  renterId: string;

  @ApiProperty()
  startDate: Date;

  @ApiProperty()
  endDate: Date;

  @ApiProperty()
  totalDays: number;

  @ApiProperty()
  dailyRate: number;

  @ApiProperty()
  totalAmount: number;

  @ApiProperty()
  platformFee: number;

  @ApiProperty()
  ownerPayout: number;

  @ApiProperty({ enum: ['pending', 'approved', 'rejected', 'cancelled', 'completed'] })
  status: BookingStatus;

  @ApiProperty({ required: false })
  stripePaymentIntentId?: string;

  @ApiProperty({ required: false })
  clientSecret?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
