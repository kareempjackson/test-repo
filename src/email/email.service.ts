import { Injectable, Logger } from '@nestjs/common';

export interface BookingEmailData {
  recipientEmail: string;
  recipientName: string;
  vehicleMake: string;
  vehicleModel: string;
  startDate: Date;
  endDate: Date;
  totalAmount: number;
  bookingId: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async sendBookingRequestToOwner(data: BookingEmailData): Promise<void> {
    this.logger.log(`Sending booking request email to owner: ${data.recipientEmail}`);
    this.logger.debug(`Booking ${data.bookingId} for ${data.vehicleMake} ${data.vehicleModel}`);
    // TODO: Integrate with actual email provider (SendGrid, SES, etc.)
  }

  async sendBookingApprovedToRenter(data: BookingEmailData & { paymentLink: string }): Promise<void> {
    this.logger.log(`Sending booking approved email to renter: ${data.recipientEmail}`);
    this.logger.debug(`Booking ${data.bookingId} approved, payment link: ${data.paymentLink}`);
  }

  async sendBookingRejectedToRenter(data: BookingEmailData & { reason?: string }): Promise<void> {
    this.logger.log(`Sending booking rejected email to renter: ${data.recipientEmail}`);
    this.logger.debug(`Booking ${data.bookingId} rejected`);
  }

  async sendPaymentConfirmedToOwner(data: BookingEmailData): Promise<void> {
    this.logger.log(`Sending payment confirmed email to owner: ${data.recipientEmail}`);
    this.logger.debug(`Payment confirmed for booking ${data.bookingId}`);
  }

  async sendPaymentConfirmedToRenter(data: BookingEmailData): Promise<void> {
    this.logger.log(`Sending payment confirmed email to renter: ${data.recipientEmail}`);
    this.logger.debug(`Payment confirmed for booking ${data.bookingId}`);
  }
}
