import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MessagesService } from '../messages/messages.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingStatus } from '@prisma/client';

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messagesService: MessagesService,
  ) {}

  async createBooking(renterId: string, createBookingDto: CreateBookingDto) {
    const { vehicleId, startDate, endDate } = createBookingDto;

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    if (!vehicle.isAvailable) {
      throw new BadRequestException('Vehicle is not available for booking');
    }

    if (vehicle.ownerId === renterId) {
      throw new BadRequestException('You cannot book your own vehicle');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      throw new BadRequestException('End date must be after start date');
    }

    if (start < new Date()) {
      throw new BadRequestException('Start date cannot be in the past');
    }

    // Check for overlapping bookings
    const overlappingBooking = await this.prisma.booking.findFirst({
      where: {
        vehicleId,
        status: { in: ['PENDING', 'CONFIRMED', 'ACTIVE'] },
        OR: [
          { startDate: { lte: end }, endDate: { gte: start } },
        ],
      },
    });

    if (overlappingBooking) {
      throw new BadRequestException('Vehicle is already booked for these dates');
    }

    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const totalPrice = Number(vehicle.dailyRate) * days;

    return this.prisma.booking.create({
      data: {
        vehicleId,
        renterId,
        startDate: start,
        endDate: end,
        totalPrice,
        status: BookingStatus.PENDING,
      },
      include: {
        vehicle: true,
        renter: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async getBookingsForUser(userId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [bookings, totalCount] = await Promise.all([
      this.prisma.booking.findMany({
        where: {
          OR: [
            { renterId: userId },
            { vehicle: { ownerId: userId } },
          ],
        },
        include: {
          vehicle: {
            include: {
              owner: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          renter: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.booking.count({
        where: {
          OR: [
            { renterId: userId },
            { vehicle: { ownerId: userId } },
          ],
        },
      }),
    ]);

    // Add unread_count to each booking
    const bookingIds = bookings.map((b) => b.id);
    const unreadCounts = await this.messagesService.getUnreadCountsForBookings(bookingIds, userId);

    const bookingsWithUnreadCount = bookings.map((booking) => ({
      ...booking,
      unread_count: unreadCounts.get(booking.id) || 0,
    }));

    return {
      bookings: bookingsWithUnreadCount,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + bookings.length < totalCount,
      },
    };
  }

  async getBookingById(bookingId: string, userId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        vehicle: {
          include: {
            owner: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        renter: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const isRenter = booking.renterId === userId;
    const isOwner = booking.vehicle.ownerId === userId;

    if (!isRenter && !isOwner) {
      throw new ForbiddenException('You do not have access to this booking');
    }

    const unreadCount = await this.messagesService.getUnreadCountForBooking(bookingId, userId);

    return {
      ...booking,
      unread_count: unreadCount,
    };
  }

  async updateBookingStatus(
    bookingId: string,
    userId: string,
    status: BookingStatus,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { vehicle: true },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const isOwner = booking.vehicle.ownerId === userId;
    const isRenter = booking.renterId === userId;

    // Only owner can confirm, only renter/owner can cancel
    if (status === BookingStatus.CONFIRMED && !isOwner) {
      throw new ForbiddenException('Only the vehicle owner can confirm bookings');
    }

    if (status === BookingStatus.CANCELLED && !isOwner && !isRenter) {
      throw new ForbiddenException('Only the booking participants can cancel');
    }

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: { status },
      include: {
        vehicle: true,
        renter: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }
}
