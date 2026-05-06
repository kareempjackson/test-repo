import {
  Controller,
  Post,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
  Req,
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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('bookings')
@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @Roles('renter', 'both', 'admin')
  @ApiOperation({ summary: 'Create a new booking request' })
  @ApiResponse({ status: 201, description: 'Booking created successfully', type: BookingResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 404, description: 'Vehicle not found' })
  @ApiResponse({ status: 409, description: 'Vehicle not available for selected dates' })
  async createBooking(
    @Req() req: any,
    @Body() createBookingDto: CreateBookingDto,
  ): Promise<BookingResponseDto> {
    return this.bookingsService.createBooking(req.user.userId, createBookingDto);
  }

  @Get()
  @Roles('owner', 'both', 'admin')
  @ApiOperation({ summary: 'Get all bookings for owner vehicles' })
  @ApiResponse({ status: 200, description: 'List of bookings', type: [BookingResponseDto] })
  async getOwnerBookings(@Req() req: any): Promise<BookingResponseDto[]> {
    return this.bookingsService.getOwnerBookings(req.user.userId);
  }

  @Get('my-rentals')
  @Roles('renter', 'both', 'admin')
  @ApiOperation({ summary: 'Get all bookings made by the current user as a renter' })
  @ApiResponse({ status: 200, description: 'List of bookings', type: [BookingResponseDto] })
  async getRenterBookings(@Req() req: any): Promise<BookingResponseDto[]> {
    return this.bookingsService.getRenterBookings(req.user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get booking by ID' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({ status: 200, description: 'Booking details', type: BookingResponseDto })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async getBookingById(
    @Param('id') id: string,
    @Req() req: any,
  ): Promise<BookingResponseDto> {
    return this.bookingsService.getBookingById(id, req.user.userId);
  }

  @Put(':id/approve')
  @Roles('owner', 'both', 'admin')
  @ApiOperation({ summary: 'Approve a booking request' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({ status: 200, description: 'Booking approved, returns client_secret for payment' })
  @ApiResponse({ status: 400, description: 'Invalid booking status' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async approveBooking(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.bookingsService.approveBooking(id, req.user.userId);
  }

  @Put(':id/reject')
  @Roles('owner', 'both', 'admin')
  @ApiOperation({ summary: 'Reject a booking request' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({ status: 200, description: 'Booking rejected' })
  @ApiResponse({ status: 400, description: 'Invalid booking status' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async rejectBooking(
    @Param('id') id: string,
    @Req() req: any,
  ): Promise<BookingResponseDto> {
    return this.bookingsService.rejectBooking(id, req.user.userId);
  }

  @Post(':id/confirm-payment')
  @Roles('renter', 'both', 'admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm payment after Stripe client-side confirmation' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({ status: 200, description: 'Payment confirmed, booking finalized' })
  @ApiResponse({ status: 400, description: 'Payment not completed' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async confirmPayment(
    @Param('id') id: string,
    @Req() req: any,
  ): Promise<BookingResponseDto> {
    return this.bookingsService.confirmPayment(id, req.user.userId);
  }
}
