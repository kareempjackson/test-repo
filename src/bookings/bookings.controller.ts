import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  UseGuards,
  Request,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingResponseDto } from './dto/booking-response.dto';
import { ApproveBookingResponseDto } from './dto/approve-booking-response.dto';
import { RejectBookingDto } from './dto/reject-booking.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('bookings')
@Controller('bookings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new booking request' })
  @ApiResponse({ status: 201, description: 'Booking created successfully', type: BookingResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input or dates' })
  @ApiResponse({ status: 409, description: 'Vehicle not available for selected dates' })
  async createBooking(
    @Request() req: { user: { id: string } },
    @Body() dto: CreateBookingDto,
  ): Promise<BookingResponseDto> {
    return this.bookingsService.createBooking(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all bookings for owner vehicles' })
  @ApiResponse({ status: 200, description: 'List of bookings', type: [BookingResponseDto] })
  async getOwnerBookings(@Request() req: { user: { id: string } }): Promise<BookingResponseDto[]> {
    return this.bookingsService.getOwnerBookings(req.user.id);
  }

  @Put(':id/approve')
  @ApiOperation({ summary: 'Approve a booking request (owner only)' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({ status: 200, description: 'Booking approved, payment intent created', type: ApproveBookingResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid booking status or Stripe Connect not set up' })
  @ApiResponse({ status: 403, description: 'Not authorized to approve this booking' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async approveBooking(
    @Request() req: { user: { id: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApproveBookingResponseDto> {
    return this.bookingsService.approveBooking(id, req.user.id);
  }

  @Put(':id/reject')
  @ApiOperation({ summary: 'Reject a booking request (owner only)' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({ status: 200, description: 'Booking rejected', type: BookingResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid booking status' })
  @ApiResponse({ status: 403, description: 'Not authorized to reject this booking' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async rejectBooking(
    @Request() req: { user: { id: string } },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectBookingDto,
  ): Promise<BookingResponseDto> {
    return this.bookingsService.rejectBooking(id, req.user.id, dto.reason);
  }

  @Post(':id/confirm-payment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm payment after Stripe client-side payment (renter only)' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({ status: 200, description: 'Payment confirmed, booking finalized', type: BookingResponseDto })
  @ApiResponse({ status: 400, description: 'Payment verification failed or invalid status' })
  @ApiResponse({ status: 403, description: 'Not authorized to confirm this payment' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async confirmPayment(
    @Request() req: { user: { id: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BookingResponseDto> {
    return this.bookingsService.confirmPayment(id, req.user.id);
  }
}
