import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  /**
   * Sends a notification email when a new message is received.
   * In production, this would integrate with an email provider like SendGrid, SES, etc.
   */
  async sendMessageNotification(
    recipientEmail: string,
    senderName: string,
    bookingId: string,
  ): Promise<void> {
    // For v1, log the email that would be sent
    // In production, integrate with actual email service
    this.logger.log(
      `[EMAIL] To: ${recipientEmail} | Subject: New message from ${senderName} | ` +
        `Body: You have a new message regarding your booking (${bookingId}). ` +
        `Log in to view and respond.`,
    );

    // Simulate async email sending
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  async sendBookingConfirmation(
    recipientEmail: string,
    bookingDetails: {
      bookingId: string;
      vehicleName: string;
      startDate: Date;
      endDate: Date;
    },
  ): Promise<void> {
    this.logger.log(
      `[EMAIL] To: ${recipientEmail} | Subject: Booking Confirmed | ` +
        `Body: Your booking for ${bookingDetails.vehicleName} from ` +
        `${bookingDetails.startDate.toISOString()} to ${bookingDetails.endDate.toISOString()} ` +
        `has been confirmed. Booking ID: ${bookingDetails.bookingId}`,
    );

    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
