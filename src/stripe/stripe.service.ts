import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private stripe: Stripe;
  private readonly logger = new Logger(StripeService.name);

  constructor(private configService: ConfigService) {
    this.stripe = new Stripe(this.configService.get<string>('STRIPE_SECRET_KEY'), {
      apiVersion: '2023-10-16',
    });
  }

  async createPaymentIntent(
    amount: number,
    currency: string,
    metadata: Record<string, string>,
    connectedAccountId?: string,
    applicationFeeAmount?: number,
  ): Promise<Stripe.PaymentIntent> {
    const params: Stripe.PaymentIntentCreateParams = {
      amount,
      currency,
      metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    };

    if (connectedAccountId && applicationFeeAmount) {
      params.application_fee_amount = applicationFeeAmount;
      params.transfer_data = {
        destination: connectedAccountId,
      };
    }

    try {
      const paymentIntent = await this.stripe.paymentIntents.create(params);
      this.logger.log(`PaymentIntent created: ${paymentIntent.id}`);
      return paymentIntent;
    } catch (error) {
      this.logger.error(`Failed to create PaymentIntent: ${error.message}`);
      throw error;
    }
  }

  async retrievePaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      return await this.stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      this.logger.error(`Failed to retrieve PaymentIntent: ${error.message}`);
      throw error;
    }
  }

  async createConnectedAccount(email: string, country: string = 'US'): Promise<Stripe.Account> {
    try {
      const account = await this.stripe.accounts.create({
        type: 'express',
        email,
        country,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
      this.logger.log(`Connected account created: ${account.id}`);
      return account;
    } catch (error) {
      this.logger.error(`Failed to create connected account: ${error.message}`);
      throw error;
    }
  }

  async createAccountLink(
    accountId: string,
    refreshUrl: string,
    returnUrl: string,
  ): Promise<Stripe.AccountLink> {
    try {
      return await this.stripe.accountLinks.create({
        account: accountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding',
      });
    } catch (error) {
      this.logger.error(`Failed to create account link: ${error.message}`);
      throw error;
    }
  }

  async retrieveAccount(accountId: string): Promise<Stripe.Account> {
    try {
      return await this.stripe.accounts.retrieve(accountId);
    } catch (error) {
      this.logger.error(`Failed to retrieve account: ${error.message}`);
      throw error;
    }
  }

  constructWebhookEvent(
    payload: Buffer,
    signature: string,
    webhookSecret: string,
  ): Stripe.Event {
    return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  }
}
