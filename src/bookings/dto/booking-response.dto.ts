import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BookingVehicleDto {
  @ApiProperty({ example: 'clx1234567890' })
  id: string;

  @ApiProperty({ example: 'Toyota' })
  make: string;

  @ApiProperty({ example: 'Camry' })
  model: string;

  @ApiProperty({ example: 2022 })
  year: number;
}

export class BookingRenterDto {
  @ApiProperty({ example: 'clx1234567890' })
  id: string;

  @ApiProperty({ example: 'John' })
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  lastName: string;
}

export class BookingResponseDto {
  @ApiProperty({ example: 'clx1234567890' })
  id: string;

  @ApiProperty({ type: BookingVehicleDto })
  vehicle: BookingVehicleDto;

  @ApiProperty({ type: BookingRenterDto })
  renter: BookingRenterDto;

  @ApiProperty({ example: '2024-01-15' })
  startDate: Date;

  @ApiProperty({ example: '2024-01-20' })
  endDate: Date;

  @ApiProperty({ example: '250.00' })
  totalPrice: string;

  @ApiProperty({ example: 'USD' })
  currency: string;

  @ApiProperty({ example: 'CONFIRMED' })
  status: string;

  @ApiPropertyOptional({
    description: 'Number of unread messages in this booking conversation',
    example: 3,
  })
  unreadCount?: number;

  @ApiProperty({ example: '2024-01-10T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-10T10:00:00.000Z' })
  updatedAt: Date;
}
