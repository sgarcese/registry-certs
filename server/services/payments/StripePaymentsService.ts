import Stripe from 'stripe';

import PaymentsService, {
  CardFunding,
  CreateChargeArgs,
  PaymentCharge,
  PaymentWebhookEvent,
} from './PaymentsService';

/**
 * Real Stripe driver. Uses the legacy Tokens + Charges API the city's Stripe
 * account is grandfathered into. New accounts must use PaymentIntents — see
 * PaymentsService.ts.
 */
export default class StripePaymentsService implements PaymentsService {
  private stripe: Stripe;
  private webhookSecret: string;

  constructor(secretKey: string, webhookSecret: string) {
    if (!webhookSecret) {
      // Fail closed at construction: the legacy server fell back to trusting
      // unverified webhook bodies when this was unset.
      throw new Error(
        'STRIPE_WEBHOOK_SECRET must be set when using the Stripe payments driver'
      );
    }

    this.stripe = new Stripe(secretKey, {
      // Pin so SDK upgrades don't silently change response shapes.
      apiVersion: '2024-06-20',
    });
    this.webhookSecret = webhookSecret;
  }

  private static toPaymentCharge(charge: Stripe.Charge): PaymentCharge {
    return {
      id: charge.id,
      amount: charge.amount,
      created: charge.created,
      captured: !!charge.captured,
      refunded: !!charge.refunded,
      metadata: (charge.metadata || {}) as { [key: string]: string },
    };
  }

  async createCharge(args: CreateChargeArgs): Promise<PaymentCharge> {
    const charge = await this.stripe.charges.create({
      amount: args.amount,
      currency: 'usd',
      source: args.cardToken,
      description: args.description,
      capture: args.capture,
      statement_descriptor: args.statementDescriptor,
      metadata: args.metadata,
    });

    return StripePaymentsService.toPaymentCharge(charge);
  }

  async captureCharge(transactionId: string): Promise<void> {
    await this.stripe.charges.capture(transactionId);
  }

  async retrieveCharge(transactionId: string): Promise<PaymentCharge> {
    const charge = await this.stripe.charges.retrieve(transactionId);
    return StripePaymentsService.toPaymentCharge(charge);
  }

  async refundCharge(transactionId: string): Promise<void> {
    await this.stripe.refunds.create({ charge: transactionId });
  }

  async retrieveTokenFunding(cardToken: string): Promise<CardFunding> {
    const token = await this.stripe.tokens.retrieve(cardToken);
    const funding = token.card && token.card.funding;

    switch (funding) {
      case 'credit':
      case 'debit':
      case 'prepaid':
        return funding;
      default:
        return 'unknown';
    }
  }

  constructWebhookEvent(
    rawBody: string,
    signature: string
  ): PaymentWebhookEvent {
    // Throws on a missing/invalid signature.
    const event = this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      this.webhookSecret
    );

    return {
      id: event.id,
      type: event.type,
      data: {
        object: StripePaymentsService.toPaymentCharge(
          event.data.object as Stripe.Charge
        ),
      },
    };
  }
}
