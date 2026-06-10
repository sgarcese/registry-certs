import crypto from 'crypto';

import PaymentsService, {
  CardFunding,
  CreateChargeArgs,
  PaymentCharge,
  PaymentError,
  PaymentWebhookEvent,
} from './PaymentsService';

/**
 * In-process payments fake for the prototype environments. Deterministic, no
 * external calls, but keeps the webhook path honest: simulated webhooks are
 * still HMAC-signed (Stripe's v1 scheme) and verified against
 * STRIPE_WEBHOOK_SECRET, so the fail-closed verification code is exercised
 * end-to-end. See scripts/simulate-webhook.ts.
 *
 * Special card tokens drive failure paths:
 *   tok-stub-card-declined  -> StripeCardError on createCharge
 *   tok-stub-debit          -> token funding reported as 'debit'
 */
export default class StubPaymentsService implements PaymentsService {
  private webhookSecret: string;
  private charges: Map<string, PaymentCharge> = new Map();

  constructor(webhookSecret: string) {
    if (!webhookSecret) {
      throw new Error(
        'STRIPE_WEBHOOK_SECRET must be set even for the stub payments driver — simulated webhooks are signed'
      );
    }
    this.webhookSecret = webhookSecret;
  }

  async createCharge(args: CreateChargeArgs): Promise<PaymentCharge> {
    if (args.cardToken === 'tok-stub-card-declined') {
      const err: PaymentError = new Error('Your card was declined. (stub)');
      err.type = 'StripeCardError';
      err.code = 'card_declined';
      throw err;
    }

    const charge: PaymentCharge = {
      id: `ch_stub_${crypto.randomBytes(8).toString('hex')}`,
      amount: args.amount,
      created: Math.floor(Date.now() / 1000),
      captured: args.capture,
      refunded: false,
      metadata: args.metadata,
    };

    this.charges.set(charge.id, charge);

    return charge;
  }

  private getCharge(transactionId: string): PaymentCharge {
    const charge = this.charges.get(transactionId);

    if (!charge) {
      const err: PaymentError = new Error(
        `No such charge: ${transactionId} (stub)`
      );
      err.code = 'resource_missing';
      throw err;
    }

    return charge;
  }

  async captureCharge(transactionId: string): Promise<void> {
    const charge = this.getCharge(transactionId);
    charge.captured = true;
  }

  async retrieveCharge(transactionId: string): Promise<PaymentCharge> {
    return this.getCharge(transactionId);
  }

  async refundCharge(transactionId: string): Promise<void> {
    const charge = this.getCharge(transactionId);
    charge.refunded = true;
  }

  async retrieveTokenFunding(cardToken: string): Promise<CardFunding> {
    return cardToken === 'tok-stub-debit' ? 'debit' : 'credit';
  }

  constructWebhookEvent(
    rawBody: string,
    signature: string
  ): PaymentWebhookEvent {
    verifyStripeStyleSignature(rawBody, signature, this.webhookSecret);
    return JSON.parse(rawBody);
  }
}

/**
 * Verifies Stripe's `t=<timestamp>,v1=<hmac>` signature scheme. Throws on any
 * missing or invalid signature so webhook handling fails closed in stub mode
 * exactly like it does with the real SDK.
 */
export function verifyStripeStyleSignature(
  rawBody: string,
  signature: string,
  secret: string
): void {
  const parts = new Map(
    (signature || '')
      .split(',')
      .map(kv => kv.split('=') as [string, string])
  );

  const timestamp = parts.get('t');
  const expected = parts.get('v1');

  if (!timestamp || !expected) {
    throw new Error('Missing or malformed webhook signature');
  }

  const computed = computeStripeStyleSignature(rawBody, timestamp, secret);

  const expectedBuf = Buffer.from(expected, 'utf8');
  const computedBuf = Buffer.from(computed, 'utf8');

  if (
    expectedBuf.length !== computedBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, computedBuf)
  ) {
    throw new Error('Webhook signature verification failed');
  }
}

export function computeStripeStyleSignature(
  rawBody: string,
  timestamp: string,
  secret: string
): string {
  return crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`, 'utf8')
    .digest('hex');
}
