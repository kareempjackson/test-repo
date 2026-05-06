import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { StripeModule } from '../stripe/stripe.module';
import { BookingsModule } from '../bookings/bookings.module';

@Module({
  imports: [StripeModule, BookingsModule],
  controllers: [WebhooksController],
})
export class WebhooksModule {}
