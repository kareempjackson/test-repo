import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { EmailService } from '../email/email.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingStatus } from '@prisma/client';

@Injectable()
export class BookingsService {
  private readonly PLATFORM_FEE_RATE = 0.15;

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly emailService: EmailService,
  ) {}

  async createBooking(renterId: string, dto: CreateBookingDto) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (startDate >= endDate) {
      throw new BadRequestException('End date must be after start date');
    }

    if (startDate < new Date()) {
      throw new BadRequestException('Start date cannot be in the past');
    }

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: dto.vehicleId },
      include: { owner: true },
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

    const conflictingBookings = await this.prisma.booking.findMany({
      where: {
        vehicleId: dto.vehicleId,
        status: { in: ['pending', 'approved'] },
        OR: [
          {
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
        ],
      },
    });

    if (conflictingBookings.length > 0) {
      throw new ConflictException('Vehicle is not available for the selected dates');
    }

    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const totalAmount = vehicle.dailyRate * totalDays;
    const platformFee = totalAmount * this.PLATFORM_FEE_RATE;
    const ownerPayout = totalAmount - platformFee;

    const booking = await this.prisma.booking.create({
      data: {
        vehicleId: dto.vehicleId,
        renterId,
        startDate,
        endDate,
        totalDays,
        dailyRate: vehicle.dailyRate,
        totalAmount,
        platformFee,
        ownerPayout,
        status: 'pending',
      },
      include: {
        vehicle: { include: { owner: true } },
        renter: true,
      },
    });

    await this.emailService.sendBookingRequestNotification(
      vehicle.owner.email,
      {
        ownerName: vehicle.owner.firstName || 'Vehicle Owner',
        renterName: `${booking.renter.firstName} ${booking.renter.lastName}`,
        vehicleName: `${vehicle.make} ${vehicle.model}`,
        startDate: startDate.toLocaleDateString(),
        endDate: endDate.toLocaleDateString(),
        totalAmount,
      },
    );

    return booking;
  }

  async getOwnerBookings(ownerId: string) {
    const ownerVehicles = await this.prisma.vehicle.findMany({
      where: { ownerId },
      select: { id: true },
    });

    const vehicleIds = ownerVehicles.map((v) => v.id);

    return this.prisma.booking.findMany({
      where: { vehicleId: { in: vehicleIds } },
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
  }

  async getRenterBookings(renterId: string) {
    return this.prisma.booking.findMany({
      where: { renterId },
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
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveBooking(bookingId: string, ownerId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        vehicle: { include: { owner: true } },
        renter: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.vehicle.ownerId !== ownerId) {
      throw new ForbiddenException('You are not authorized to approve this booking');
    }

    if (booking.status !== 'pending') {
      throw new BadRequestException('Only pending bookings can be approved');
    }

    const paymentIntent = await this.stripeService.createPaymentIntent(
      Math.round(booking.totalAmount * 100),
      'usd',
      {
        bookingId: booking.id,
        renterId: booking.renterId,
        ownerId: booking.vehicle.ownerId,
        ownerStripeAccountId: booking.vehicle.owner.stripeConnectAccountId || undefined,
      },
      booking.vehicle.owner.stripeConnectAccountId || undefined,
      Math.round(booking.platformFee * 100),
    );

    const updatedBooking = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'approved',
        stripePaymentIntentId: paymentIntent.id,
      },
    });

    await this.emailService.sendBookingApprovedNotification(
      booking.renter.email,
      {
        renterName: booking.renter.firstName || 'Renter',
        vehicleName: `${booking.vehicle.make} ${booking.vehicle.model}`,
        startDate: booking.startDate.toLocaleDateString(),
        endDate: booking.endDate.toLocaleDateString(),
        totalAmount: booking.totalAmount,
      },
    );

    return {
      ...updatedBooking,
      clientSecret: paymentIntent.client_secret,
    };
  }

  async rejectBooking(bookingId: string, ownerId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        vehicle: true,
        renter: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.vehicle.ownerId !== ownerId) {
      throw new ForbiddenException('You are not authorized to reject this booking');
    }

    if (booking.status !== 'pending') {
      throw new BadRequestException('Only pending bookings can be rejected');
    }

    const updatedBooking = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'rejected' },
    });

    await this.emailService.sendBookingRejectedNotification(
      booking.renter.email,
      {
        renterName: booking.renter.firstName || 'Renter',
        vehicleName: `${booking.vehicle.make} ${booking.vehicle.model}`,
        startDate: booking.startDate.toLocaleDateString(),
        endDate: booking.endDate.toLocaleDateString(),
      },
    );

    return updatedBooking;
  }

  async confirmPayment(bookingId: string, renterId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        vehicle: { include: { owner: true } },
        renter: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.renterId !== renterId) {
      throw new ForbiddenException('You are not authorized to confirm this payment');
    }

    if (booking.status !== 'approved') {
      throw new BadRequestException('Booking must be approved before payment confirmation');
    }

    if (!booking.stripePaymentIntentId) {
      throw new BadRequestException('No payment intent found for this booking');
    }

    const paymentIntent = await this.stripeService.retrievePaymentIntent(
      booking.stripePaymentIntentId,
    );

    if (paymentIntent.status !== 'succeeded') {
      throw new BadRequestException('Payment has not been completed');
    }

    const updatedBooking = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'approved',
        paymentConfirmedAt: new Date(),
      },
    });

    await this.prisma.vehicleAvailability.create({
      data: {
        vehicleId: booking.vehicleId,
        startDate: booking.startDate,
        endDate: booking.endDate,
        isBlocked: true,
        bookingId: booking.id,
      },
    });

    await Promise.all([
      this.emailService.sendPaymentConfirmedToRenter(
        booking.renter.email,
        {
          renterName: booking.renter.firstName || 'Renter',
          vehicleName: `${booking.vehicle.make} ${booking.vehicle.model}`,
          startDate: booking.startDate.toLocaleDateString(),
          endDate: booking.endDate.toLocaleDateString(),
          totalAmount: booking.totalAmount,
        },
      ),
      this.emailService.sendPaymentConfirmedToOwner(
        booking.vehicle.owner.email,
        {
          ownerName: booking.vehicle.owner.firstName || 'Owner',
          renterName: `${booking.renter.firstName} ${booking.renter.lastName}`,
          vehicleName: `${booking.vehicle.make} ${booking.vehicle.model}`,
          startDate: booking.startDate.toLocaleDateString(),
          endDate: booking.endDate.toLocaleDateString(),
          ownerPayout: booking.ownerPayout,
        },
      ),
    ]);

    return updatedBooking;
  }

  async handlePaymentIntentSucceeded(paymentIntentId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { stripePaymentIntentId: paymentIntentId },
      include: {
        vehicle: { include: { owner: true } },
        renter: true,
      },
    });

    if (!booking) {
      return;
    }

    if (booking.paymentConfirmedAt) {
      return;
    }

    await this.prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: 'approved',
        paymentConfirmedAt: new Date(),
      },
    });

    const existingAvailability = await this.prisma.vehicleAvailability.findFirst({
      where: { bookingId: booking.id },
    });

    if (!existingAvailability) {
      await this.prisma.vehicleAvailability.create({
        data: {
          vehicleId: booking.vehicleId,
          startDate: booking.startDate,
          endDate: booking.endDate,
          isBlocked: true,
          bookingId: booking.id,
        },
      });
    }

    await Promise.all([
      this.emailService.sendPaymentConfirmedToRenter(
        booking.renter.email,
        {
          renterName: booking.renter.firstName || 'Renter',
          vehicleName: `${booking.vehicle.make} ${booking.vehicle.model}`,
          startDate: booking.startDate.toLocaleDateString(),
          endDate: booking.endDate.toLocaleDateString(),
          totalAmount: booking.totalAmount,
        },
      ),
      this.emailService.sendPaymentConfirmedToOwner(
        booking.vehicle.owner.email,
        {
          ownerName: booking.vehicle.owner.firstName || 'Owner',
          renterName: `${booking.renter.firstName} ${booking.renter.lastName}`,
          vehicleName: `${booking.vehicle.make} ${booking.vehicle.model}`,
          startDate: booking.startDate.toLocaleDateString(),
          endDate: booking.endDate.toLocaleDateString(),
          ownerPayout: booking.ownerPayout,
        },
      ),
    ]);
  }

  async getBookingById(bookingId: string, userId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        vehicle: { include: { owner: true } },
        renter: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.renterId !== userId && booking.vehicle.ownerId !== userId) {
      throw new ForbiddenException('You are not authorized to view this booking');
    }

    return booking;
  }
}
