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
  totalAmount: number;

  @ApiProperty()
  platformFee: number;

  @ApiProperty()
  ownerPayout: number;

  @ApiProperty({ enum: BookingStatus })
  status: BookingStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ required: false })
  vehicle?: {
    id: string;
    make: string;
    model: string;
    year: number;
    dailyRate: number;
    location: string;
  };

  @ApiProperty({ required: false })
  renter?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}
