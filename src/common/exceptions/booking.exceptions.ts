import { HttpException, HttpStatus } from '@nestjs/common';

export class VehicleNotAvailableException extends HttpException {
  constructor(message = 'Vehicle is not available for the selected dates') {
    super(message, HttpStatus.CONFLICT);
  }
}

export class BookingNotFoundException extends HttpException {
  constructor(bookingId: string) {
    super(`Booking with ID ${bookingId} not found`, HttpStatus.NOT_FOUND);
  }
}

export class UnauthorizedBookingAccessException extends HttpException {
  constructor() {
    super('You are not authorized to access this booking', HttpStatus.FORBIDDEN);
  }
}

export class InvalidBookingStatusException extends HttpException {
  constructor(currentStatus: string, requiredStatus: string) {
    super(
      `Cannot perform this action. Booking status is ${currentStatus}, expected ${requiredStatus}`,
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class PaymentVerificationException extends HttpException {
  constructor(message = 'Payment verification failed') {
    super(message, HttpStatus.BAD_REQUEST);
  }
}

export class StripeConnectRequiredException extends HttpException {
  constructor() {
    super('Vehicle owner must complete Stripe Connect onboarding to receive payments', HttpStatus.BAD_REQUEST);
  }
}
