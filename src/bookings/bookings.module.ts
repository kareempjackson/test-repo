import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { StripeModule } from '../stripe/stripe.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [StripeModule, EmailModule],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
