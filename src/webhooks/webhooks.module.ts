import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WebhooksController } from './webhooks.controller';
import { StripeModule } from '../stripe/stripe.module';
import { BookingsModule } from '../bookings/bookings.module';

@Module({
  imports: [ConfigModule, StripeModule, BookingsModule],
  controllers: [WebhooksController],
})
export class WebhooksModule {}
