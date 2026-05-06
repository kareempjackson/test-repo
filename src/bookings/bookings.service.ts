import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { EmailService, BookingEmailData } from '../email/email.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingResponseDto } from './dto/booking-response.dto';
import { ApproveBookingResponseDto } from './dto/approve-booking-response.dto';
import { PLATFORM_FEE_PERCENTAGE } from '../common/constants/fees.constant';
import {
  VehicleNotAvailableException,
  BookingNotFoundException,
  UnauthorizedBookingAccessException,
  InvalidBookingStatusException,
  PaymentVerificationException,
  StripeConnectRequiredException,
} from '../common/exceptions/booking.exceptions';
import { Booking, BookingStatus, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly emailService: EmailService,
  ) {}

  async createBooking(renterId: string, dto: CreateBookingDto): Promise<BookingResponseDto> {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (startDate >= endDate) {
      throw new VehicleNotAvailableException('Start date must be before end date');
    }

    if (startDate < new Date()) {
      throw new VehicleNotAvailableException('Start date cannot be in the past');
    }

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: dto.vehicleId },
      include: { owner: true },
    });

    if (!vehicle) {
      throw new VehicleNotAvailableException('Vehicle not found');
    }

    if (!vehicle.isAvailable) {
      throw new VehicleNotAvailableException('Vehicle is not available for booking');
    }

    if (vehicle.ownerId === renterId) {
      throw new VehicleNotAvailableException('You cannot book your own vehicle');
    }

    const isAvailable = await this.checkAvailability(dto.vehicleId, startDate, endDate);
    if (!isAvailable) {
      throw new VehicleNotAvailableException();
    }

    const days = this.calculateDays(startDate, endDate);
    const dailyRate = new Decimal(vehicle.dailyRate.toString());
    const totalAmount = dailyRate.mul(days);
    const platformFee = totalAmount.mul(PLATFORM_FEE_PERCENTAGE);
    const ownerPayout = totalAmount.sub(platformFee);

    const booking = await this.prisma.booking.create({
      data: {
        vehicleId: dto.vehicleId,
        renterId,
        startDate,
        endDate,
        totalAmount,
        platformFee,
        ownerPayout,
        status: BookingStatus.PENDING,
      },
      include: {
        vehicle: true,
        renter: true,
      },
    });

    const renter = await this.prisma.user.findUnique({ where: { id: renterId } });

    await this.emailService.sendBookingRequestToOwner({
      recipientEmail: vehicle.owner.email,
      recipientName: `${vehicle.owner.firstName} ${vehicle.owner.lastName}`,
      vehicleMake: vehicle.make,
      vehicleModel: vehicle.model,
      startDate,
      endDate,
      totalAmount: totalAmount.toNumber(),
      bookingId: booking.id,
    });

    this.logger.log(`Booking ${booking.id} created for vehicle ${dto.vehicleId}`);

    return this.mapToResponse(booking);
  }

  async getOwnerBookings(ownerId: string): Promise<BookingResponseDto[]> {
    const bookings = await this.prisma.booking.findMany({
      where: {
        vehicle: {
          ownerId,
        },
      },
      include: {
        vehicle: true,
        renter: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return bookings.map((booking) => this.mapToResponse(booking));
  }

  async approveBooking(bookingId: string, ownerId: string): Promise<ApproveBookingResponseDto> {
    const booking = await this.getBookingWithAccessCheck(bookingId, ownerId, 'owner');

    if (booking.status !== BookingStatus.PENDING) {
      throw new InvalidBookingStatusException(booking.status, BookingStatus.PENDING);
    }

    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
    });

    if (!owner?.stripeConnectAccountId) {
      throw new StripeConnectRequiredException();
    }

    const accountStatus = await this.stripeService.getAccountStatus(owner.stripeConnectAccountId);
    if (!accountStatus.chargesEnabled) {
      throw new StripeConnectRequiredException();
    }

    const amountInCents = Math.round(Number(booking.totalAmount) * 100);

    const { paymentIntentId, clientSecret } = await this.stripeService.createPaymentIntent(
      amountInCents,
      'usd',
      owner.stripeConnectAccountId,
      {
        bookingId: booking.id,
        vehicleId: booking.vehicleId,
        renterId: booking.renterId,
        ownerId: ownerId,
      },
    );

    const updatedBooking = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.AWAITING_PAYMENT,
        stripePaymentIntentId: paymentIntentId,
      },
      include: {
        vehicle: true,
        renter: true,
      },
    });

    const renter = updatedBooking.renter;
    const vehicle = updatedBooking.vehicle;

    await this.emailService.sendBookingApprovedToRenter({
      recipientEmail: renter.email,
      recipientName: `${renter.firstName} ${renter.lastName}`,
      vehicleMake: vehicle.make,
      vehicleModel: vehicle.model,
      startDate: updatedBooking.startDate,
      endDate: updatedBooking.endDate,
      totalAmount: Number(updatedBooking.totalAmount),
      bookingId: updatedBooking.id,
      paymentLink: `${process.env.FRONTEND_URL}/bookings/${bookingId}/pay`,
    });

    this.logger.log(`Booking ${bookingId} approved, PaymentIntent ${paymentIntentId} created`);

    return {
      booking: this.mapToResponse(updatedBooking),
      clientSecret,
    };
  }

  async rejectBooking(bookingId: string, ownerId: string, reason?: string): Promise<BookingResponseDto> {
    const booking = await this.getBookingWithAccessCheck(bookingId, ownerId, 'owner');

    if (booking.status !== BookingStatus.PENDING) {
      throw new InvalidBookingStatusException(booking.status, BookingStatus.PENDING);
    }

    const updatedBooking = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.REJECTED,
      },
      include: {
        vehicle: true,
        renter: true,
      },
    });

    const renter = updatedBooking.renter;
    const vehicle = updatedBooking.vehicle;

    await this.emailService.sendBookingRejectedToRenter({
      recipientEmail: renter.email,
      recipientName: `${renter.firstName} ${renter.lastName}`,
      vehicleMake: vehicle.make,
      vehicleModel: vehicle.model,
      startDate: updatedBooking.startDate,
      endDate: updatedBooking.endDate,
      totalAmount: Number(updatedBooking.totalAmount),
      bookingId: updatedBooking.id,
      reason,
    });

    this.logger.log(`Booking ${bookingId} rejected`);

    return this.mapToResponse(updatedBooking);
  }

  async confirmPayment(bookingId: string, renterId: string): Promise<BookingResponseDto> {
    const booking = await this.getBookingWithAccessCheck(bookingId, renterId, 'renter');

    if (booking.status !== BookingStatus.AWAITING_PAYMENT) {
      throw new InvalidBookingStatusException(booking.status, BookingStatus.AWAITING_PAYMENT);
    }

    if (!booking.stripePaymentIntentId) {
      throw new PaymentVerificationException('No payment intent associated with this booking');
    }

    const paymentIntent = await this.stripeService.retrievePaymentIntent(booking.stripePaymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      throw new PaymentVerificationException(`Payment not successful. Status: ${paymentIntent.status}`);
    }

    return this.finalizeBookingPayment(bookingId);
  }

  async handlePaymentSucceeded(paymentIntentId: string): Promise<void> {
    const booking = await this.prisma.booking.findFirst({
      where: { stripePaymentIntentId: paymentIntentId },
    });

    if (!booking) {
      this.logger.warn(`No booking found for PaymentIntent ${paymentIntentId}`);
      return;
    }

    if (booking.status === BookingStatus.APPROVED) {
      this.logger.log(`Booking ${booking.id} already approved, skipping webhook`);
      return;
    }

    await this.finalizeBookingPayment(booking.id);
    this.logger.log(`Booking ${booking.id} finalized via webhook`);
  }

  private async finalizeBookingPayment(bookingId: string): Promise<BookingResponseDto> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        vehicle: { include: { owner: true } },
        renter: true,
      },
    });

    if (!booking) {
      throw new BookingNotFoundException(bookingId);
    }

    const datesToBlock = this.getDateRange(booking.startDate, booking.endDate);

    await this.prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.APPROVED },
      });

      await tx.blockedDate.createMany({
        data: datesToBlock.map((date) => ({
          vehicleId: booking.vehicleId,
          date,
          bookingId,
        })),
        skipDuplicates: true,
      });
    });

    const emailData: BookingEmailData = {
      recipientEmail: '',
      recipientName: '',
      vehicleMake: booking.vehicle.make,
      vehicleModel: booking.vehicle.model,
      startDate: booking.startDate,
      endDate: booking.endDate,
      totalAmount: Number(booking.totalAmount),
      bookingId: booking.id,
    };

    await this.emailService.sendPaymentConfirmedToOwner({
      ...emailData,
      recipientEmail: booking.vehicle.owner.email,
      recipientName: `${booking.vehicle.owner.firstName} ${booking.vehicle.owner.lastName}`,
    });

    await this.emailService.sendPaymentConfirmedToRenter({
      ...emailData,
      recipientEmail: booking.renter.email,
      recipientName: `${booking.renter.firstName} ${booking.renter.lastName}`,
    });

    this.logger.log(`Booking ${bookingId} payment confirmed, dates blocked`);

    const updatedBooking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { vehicle: true, renter: true },
    });

    return this.mapToResponse(updatedBooking!);
  }

  private async checkAvailability(vehicleId: string, startDate: Date, endDate: Date): Promise<boolean> {
    const overlappingBookings = await this.prisma.booking.count({
      where: {
        vehicleId,
        status: {
          in: [BookingStatus.PENDING, BookingStatus.AWAITING_PAYMENT, BookingStatus.APPROVED],
        },
        OR: [
          {
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
        ],
      },
    });

    if (overlappingBookings > 0) {
      return false;
    }

    const blockedDates = await this.prisma.blockedDate.count({
      where: {
        vehicleId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    return blockedDates === 0;
  }

  private async getBookingWithAccessCheck(
    bookingId: string,
    userId: string,
    role: 'owner' | 'renter',
  ): Promise<Booking & { vehicle: { ownerId: string } }> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { vehicle: true },
    });

    if (!booking) {
      throw new BookingNotFoundException(bookingId);
    }

    if (role === 'owner' && booking.vehicle.ownerId !== userId) {
      throw new UnauthorizedBookingAccessException();
    }

    if (role === 'renter' && booking.renterId !== userId) {
      throw new UnauthorizedBookingAccessException();
    }

    return booking as Booking & { vehicle: { ownerId: string } };
  }

  private calculateDays(startDate: Date, endDate: Date): number {
    const diffTime = endDate.getTime() - startDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  private getDateRange(startDate: Date, endDate: Date): Date[] {
    const dates: Date[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return dates;
  }

  private mapToResponse(booking: any): BookingResponseDto {
    return {
      id: booking.id,
      vehicleId: booking.vehicleId,
      renterId: booking.renterId,
      startDate: booking.startDate,
      endDate: booking.endDate,
      totalAmount: Number(booking.totalAmount),
      platformFee: Number(booking.platformFee),
      ownerPayout: Number(booking.ownerPayout),
      status: booking.status,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
      vehicle: booking.vehicle
        ? {
            id: booking.vehicle.id,
            make: booking.vehicle.make,
            model: booking.vehicle.model,
            year: booking.vehicle.year,
            dailyRate: Number(booking.vehicle.dailyRate),
            location: booking.vehicle.location,
          }
        : undefined,
      renter: booking.renter
        ? {
            id: booking.renter.id,
            firstName: booking.renter.firstName,
            lastName: booking.renter.lastName,
            email: booking.renter.email,
          }
        : undefined,
    };
  }
}
