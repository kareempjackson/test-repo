import { Injectable } from '@nestjs/common';

@Injectable()
export class EmailService {
  /**
   * Send a notification email when a new message is received.
   * In production, integrate with an email provider (SendGrid, AWS SES, etc.)
   */
  async sendMessageNotification(
    recipientEmail: string,
    recipientName: string,
    senderName: string,
    bookingId: string,
  ): Promise<void> {
    // TODO: Integrate with actual email provider in production
    console.log(
      `[EMAIL] Sending message notification to ${recipientEmail}:`,
      `"Hi ${recipientName}, you have a new message from ${senderName} regarding booking ${bookingId}"`
    );
  }

  /**
   * Generic email sending method for future use
   */
  async sendEmail(
    to: string,
    subject: string,
    html: string,
  ): Promise<void> {
    // TODO: Integrate with actual email provider in production
    console.log(`[EMAIL] Sending to ${to}: ${subject}`);
  }
}
