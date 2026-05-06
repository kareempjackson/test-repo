import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MessagesService } from '../messages/messages.service';
import { BookingStatus, Prisma } from '@prisma/client';

export interface CreateBookingDto {
  vehicleId: string;
  startDate: Date;
  endDate: Date;
}

export interface BookingWithUnreadCount {
  id: string;
  vehicleId: string;
  renterId: string;
  startDate: Date;
  endDate: Date;
  totalPrice: Prisma.Decimal;
  status: BookingStatus;
  createdAt: Date;
  updatedAt: Date;
  vehicle?: any;
  renter?: any;
  unreadCount: number;
}

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messagesService: MessagesService,
  ) {}

  async createBooking(
    renterId: string,
    dto: CreateBookingDto,
  ): Promise<BookingWithUnreadCount> {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: dto.vehicleId },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    if (vehicle.ownerId === renterId) {
      throw new BadRequestException('You cannot book your own vehicle');
    }

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (startDate >= endDate) {
      throw new BadRequestException('End date must be after start date');
    }

    if (startDate < new Date()) {
      throw new BadRequestException('Start date cannot be in the past');
    }

    // Check for overlapping bookings
    const overlapping = await this.prisma.booking.findFirst({
      where: {
        vehicleId: dto.vehicleId,
        status: { in: ['PENDING', 'CONFIRMED', 'ACTIVE'] },
        OR: [
          {
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
        ],
      },
    });

    if (overlapping) {
      throw new BadRequestException(
        'Vehicle is not available for the selected dates',
      );
    }

    const days = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const totalPrice = vehicle.dailyRate.toNumber() * days;

    const booking = await this.prisma.booking.create({
      data: {
        vehicleId: dto.vehicleId,
        renterId,
        startDate,
        endDate,
        totalPrice,
        status: 'PENDING',
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

    return { ...booking, unreadCount: 0 };
  }

  async getBookingsForUser(
    userId: string,
    role: 'renter' | 'owner',
  ): Promise<BookingWithUnreadCount[]> {
    const whereClause =
      role === 'renter'
        ? { renterId: userId }
        : { vehicle: { ownerId: userId } };

    const bookings = await this.prisma.booking.findMany({
      where: whereClause,
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
      orderBy: { createdAt: 'desc' },
    });

    const bookingIds = bookings.map((b) => b.id);
    const unreadCounts = await this.messagesService.getUnreadCountsForBookings(
      bookingIds,
      userId,
    );

    return bookings.map((booking) => ({
      ...booking,
      unreadCount: unreadCounts.get(booking.id) || 0,
    }));
  }

  async getBookingById(
    bookingId: string,
    userId: string,
  ): Promise<BookingWithUnreadCount> {
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

    const unreadCount = await this.messagesService.getUnreadCount(
      bookingId,
      userId,
    );

    return { ...booking, unreadCount };
  }

  async updateBookingStatus(
    bookingId: string,
    userId: string,
    status: BookingStatus,
  ): Promise<BookingWithUnreadCount> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { vehicle: true },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const isOwner = booking.vehicle.ownerId === userId;
    const isRenter = booking.renterId === userId;

    // Only owner can confirm, only renter can cancel pending
    if (status === 'CONFIRMED' && !isOwner) {
      throw new ForbiddenException('Only the vehicle owner can confirm bookings');
    }

    if (status === 'CANCELLED' && !isRenter && !isOwner) {
      throw new ForbiddenException('You cannot cancel this booking');
    }

    const updated = await this.prisma.booking.update({
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

    const unreadCount = await this.messagesService.getUnreadCount(
      bookingId,
      userId,
    );

    return { ...updated, unreadCount };
  }
}
