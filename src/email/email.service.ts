import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface MessageNotificationParams {
  to: string;
  recipientName: string;
  senderName: string;
  vehicleName: string;
  bookingId: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly fromEmail: string;
  private readonly appUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.fromEmail = this.configService.get<string>('EMAIL_FROM', 'noreply@newstudio.com');
    this.appUrl = this.configService.get<string>('APP_URL', 'http://localhost:3000');
  }

  async sendMessageNotification(params: MessageNotificationParams): Promise<void> {
    const { to, recipientName, senderName, vehicleName, bookingId } = params;

    const subject = `New message from ${senderName} about your ${vehicleName} booking`;
    const body = `
Hi ${recipientName},

You have received a new message from ${senderName} regarding your booking for ${vehicleName}.

View the conversation: ${this.appUrl}/bookings/${bookingId}/messages

Best regards,
New Studio Team
    `.trim();

    // In production, integrate with an email provider (SendGrid, AWS SES, etc.)
    // For now, we log the email content
    this.logger.log(`[EMAIL] To: ${to}`);
    this.logger.log(`[EMAIL] Subject: ${subject}`);
    this.logger.debug(`[EMAIL] Body: ${body}`);

    // TODO: Implement actual email sending
    // await this.sendGridService.send({ to, from: this.fromEmail, subject, text: body });
  }
}
