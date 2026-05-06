import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { GetBookingsQueryDto } from './dto/get-bookings-query.dto';

@Controller('bookings')
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  async createBooking(
    @Body() createBookingDto: CreateBookingDto,
    @Request() req: any,
  ) {
    const booking = await this.bookingsService.createBooking(
      req.user.id,
      createBookingDto,
    );
    return {
      success: true,
      data: booking,
    };
  }

  @Get()
  async getBookings(
    @Query() query: GetBookingsQueryDto,
    @Request() req: any,
  ) {
    const result = await this.bookingsService.getBookingsForUser(
      req.user.id,
      query.page || 1,
      query.limit || 10,
    );
    return {
      success: true,
      data: result.bookings,
      pagination: result.pagination,
    };
  }

  @Get(':id')
  async getBooking(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    const booking = await this.bookingsService.getBookingById(id, req.user.id);
    return {
      success: true,
      data: booking,
    };
  }

  @Patch(':id/status')
  async updateBookingStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateBookingStatusDto,
    @Request() req: any,
  ) {
    const booking = await this.bookingsService.updateBookingStatus(
      id,
      req.user.id,
      updateStatusDto.status,
    );
    return {
      success: true,
      data: booking,
    };
  }
}
