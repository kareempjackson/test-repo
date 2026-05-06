import {
  Controller,
  Get,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BookingsService } from './bookings.service';
import { BookingResponseDto } from './dto/booking-response.dto';

@ApiTags('Bookings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all bookings for the current user' })
  @ApiResponse({
    status: 200,
    description: 'List of bookings with unread message counts',
    type: [BookingResponseDto],
  })
  async findAll(
    @Request() req: { user: { id: string } },
  ): Promise<BookingResponseDto[]> {
    return this.bookingsService.findAllForUser(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific booking' })
  @ApiResponse({
    status: 200,
    description: 'Booking details with unread message count',
    type: BookingResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async findOne(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ): Promise<BookingResponseDto> {
    return this.bookingsService.findOne(id, req.user.id);
  }
}
