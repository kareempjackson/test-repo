import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { BookingsModule } from './bookings/bookings.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { StripeModule } from './stripe/stripe.module';
import { EmailModule } from './email/email.module';
import * as express from 'express';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    BookingsModule,
    WebhooksModule,
    StripeModule,
    EmailModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(express.raw({ type: 'application/json' }))
      .forRoutes({ path: 'webhooks/stripe', method: RequestMethod.POST });
  }
}
