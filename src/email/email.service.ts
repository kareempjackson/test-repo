import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface BookingRequestEmailData {
  ownerName: string;
  renterName: string;
  vehicleName: string;
  startDate: string;
  endDate: string;
  totalAmount: number;
}

interface BookingApprovedEmailData {
  renterName: string;
  vehicleName: string;
  startDate: string;
  endDate: string;
  totalAmount: number;
}

interface BookingRejectedEmailData {
  renterName: string;
  vehicleName: string;
  startDate: string;
  endDate: string;
}

interface PaymentConfirmedRenterData {
  renterName: string;
  vehicleName: string;
  startDate: string;
  endDate: string;
  totalAmount: number;
}

interface PaymentConfirmedOwnerData {
  ownerName: string;
  renterName: string;
  vehicleName: string;
  startDate: string;
  endDate: string;
  ownerPayout: number;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private configService: ConfigService) {}

  async sendBookingRequestNotification(
    to: string,
    data: BookingRequestEmailData,
  ): Promise<void> {
    this.logger.log(`Sending booking request notification to ${to}`);
    this.logger.debug(`Email data: ${JSON.stringify(data)}`);
    
    // TODO: Integrate with actual email provider (SendGrid, SES, etc.)
    // For now, just log the email that would be sent
    const emailContent = `
      Hi ${data.ownerName},
      
      You have a new booking request for your ${data.vehicleName}!
      
      Renter: ${data.renterName}
      Dates: ${data.startDate} - ${data.endDate}
      Total Amount: $${data.totalAmount.toFixed(2)}
      
      Please log in to approve or reject this request.
    `;
    
    this.logger.log(`Email content: ${emailContent}`);
  }

  async sendBookingApprovedNotification(
    to: string,
    data: BookingApprovedEmailData,
  ): Promise<void> {
    this.logger.log(`Sending booking approved notification to ${to}`);
    
    const emailContent = `
      Hi ${data.renterName},
      
      Great news! Your booking for ${data.vehicleName} has been approved!
      
      Dates: ${data.startDate} - ${data.endDate}
      Total Amount: $${data.totalAmount.toFixed(2)}
      
      Please complete your payment to finalize the booking.
    `;
    
    this.logger.log(`Email content: ${emailContent}`);
  }

  async sendBookingRejectedNotification(
    to: string,
    data: BookingRejectedEmailData,
  ): Promise<void> {
    this.logger.log(`Sending booking rejected notification to ${to}`);
    
    const emailContent = `
      Hi ${data.renterName},
      
      Unfortunately, your booking request for ${data.vehicleName} has been declined.
      
      Dates: ${data.startDate} - ${data.endDate}
      
      Please try searching for other available vehicles.
    `;
    
    this.logger.log(`Email content: ${emailContent}`);
  }

  async sendPaymentConfirmedToRenter(
    to: string,
    data: PaymentConfirmedRenterData,
  ): Promise<void> {
    this.logger.log(`Sending payment confirmed notification to renter ${to}`);
    
    const emailContent = `
      Hi ${data.renterName},
      
      Your payment has been confirmed for ${data.vehicleName}!
      
      Dates: ${data.startDate} - ${data.endDate}
      Amount Paid: $${data.totalAmount.toFixed(2)}
      
      Your booking is now confirmed. Enjoy your trip!
    `;
    
    this.logger.log(`Email content: ${emailContent}`);
  }

  async sendPaymentConfirmedToOwner(
    to: string,
    data: PaymentConfirmedOwnerData,
  ): Promise<void> {
    this.logger.log(`Sending payment confirmed notification to owner ${to}`);
    
    const emailContent = `
      Hi ${data.ownerName},
      
      Payment has been received for your ${data.vehicleName}!
      
      Renter: ${data.renterName}
      Dates: ${data.startDate} - ${data.endDate}
      Your Payout: $${data.ownerPayout.toFixed(2)} (after 15% platform fee)
      
      The funds will be transferred to your account after the rental period.
    `;
    
    this.logger.log(`Email content: ${emailContent}`);
  }
}
