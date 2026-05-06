import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MessagesService } from '../messages/messages.service';
import { BookingResponseDto } from './dto/booking-response.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messagesService: MessagesService,
  ) {}

  async findAllForUser(userId: string): Promise<BookingResponseDto[]> {
    const bookings = await this.prisma.booking.findMany({
      where: {
        OR: [
          { renterId: userId },
          { vehicle: { ownerId: userId } },
        ],
      },
      include: {
        vehicle: {
          select: {
            id: true,
            make: true,
            model: true,
            year: true,
          },
        },
        renter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const bookingIds = bookings.map((b) => b.id);
    const unreadCounts = await this.messagesService.getUnreadCountsForBookings(
      bookingIds,
      userId,
    );

    return bookings.map((booking) => ({
      id: booking.id,
      vehicle: booking.vehicle,
      renter: booking.renter,
      startDate: booking.startDate,
      endDate: booking.endDate,
      totalPrice: booking.totalPrice.toString(),
      currency: booking.currency,
      status: booking.status,
      unreadCount: unreadCounts.get(booking.id) || 0,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
    }));
  }

  async findOne(id: string, userId: string): Promise<BookingResponseDto> {
    const booking = await this.prisma.booking.findFirst({
      where: {
        id,
        OR: [
          { renterId: userId },
          { vehicle: { ownerId: userId } },
        ],
      },
      include: {
        vehicle: {
          select: {
            id: true,
            make: true,
            model: true,
            year: true,
          },
        },
        renter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const unreadCount = await this.messagesService.getUnreadCountForBooking(
      id,
      userId,
    );

    return {
      id: booking.id,
      vehicle: booking.vehicle,
      renter: booking.renter,
      startDate: booking.startDate,
      endDate: booking.endDate,
      totalPrice: booking.totalPrice.toString(),
      currency: booking.currency,
      status: booking.status,
      unreadCount,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
    };
  }
}
