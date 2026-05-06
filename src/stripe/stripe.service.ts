import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PLATFORM_FEE_PERCENTAGE } from '../common/constants/fees.constant';

@Injectable()
export class StripeService {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(StripeService.name);

  constructor(private readonly configService: ConfigService) {
    this.stripe = new Stripe(this.configService.get<string>('stripe.secretKey')!, {
      apiVersion: '2024-06-20',
    });
  }

  async createPaymentIntent(
    amountInCents: number,
    currency: string,
    ownerConnectAccountId: string,
    metadata: Record<string, string>,
  ): Promise<{ paymentIntentId: string; clientSecret: string }> {
    const platformFeeInCents = Math.round(amountInCents * PLATFORM_FEE_PERCENTAGE);

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: amountInCents,
      currency,
      metadata,
      application_fee_amount: platformFeeInCents,
      transfer_data: {
        destination: ownerConnectAccountId,
      },
    });

    this.logger.log(`Created PaymentIntent ${paymentIntent.id} for ${amountInCents} cents`);

    return {
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret!,
    };
  }

  async retrievePaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.retrieve(paymentIntentId);
  }

  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
    const webhookSecret = this.configService.get<string>('stripe.webhookSecret')!;
    return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  }

  async createConnectAccount(email: string): Promise<string> {
    const account = await this.stripe.accounts.create({
      type: 'express',
      email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    return account.id;
  }

  async createAccountLink(accountId: string, refreshUrl: string, returnUrl: string): Promise<string> {
    const accountLink = await this.stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    return accountLink.url;
  }

  async getAccountStatus(accountId: string): Promise<{ chargesEnabled: boolean; payoutsEnabled: boolean }> {
    const account = await this.stripe.accounts.retrieve(accountId);
    return {
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
    };
  }
}
