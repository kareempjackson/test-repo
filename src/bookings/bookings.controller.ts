import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BookingsService, CreateBookingDto } from './bookings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BookingStatus } from '@prisma/client';

@Controller('bookings')
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createBooking(@Body() dto: CreateBookingDto, @Request() req: any) {
    const userId = req.user.sub || req.user.id;
    return this.bookingsService.createBooking(userId, dto);
  }

  @Get()
  async getBookings(
    @Query('role') role: 'renter' | 'owner' = 'renter',
    @Request() req: any,
  ) {
    const userId = req.user.sub || req.user.id;
    return this.bookingsService.getBookingsForUser(userId, role);
  }

  @Get(':id')
  async getBooking(@Param('id') id: string, @Request() req: any) {
    const userId = req.user.sub || req.user.id;
    return this.bookingsService.getBookingById(id, userId);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: BookingStatus,
    @Request() req: any,
  ) {
    const userId = req.user.sub || req.user.id;
    return this.bookingsService.updateBookingStatus(id, userId, status);
  }
}
