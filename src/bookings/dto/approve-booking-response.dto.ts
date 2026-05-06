import { ApiProperty } from '@nestjs/swagger';
import { BookingResponseDto } from './booking-response.dto';

export class ApproveBookingResponseDto {
  @ApiProperty()
  booking: BookingResponseDto;

  @ApiProperty({ description: 'Stripe client secret for payment' })
  clientSecret: string;
}
