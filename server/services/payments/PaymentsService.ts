/**
 * Driver abstraction over the payment processor.
 *
 * The legacy app called the Stripe SDK directly with the legacy Tokens +
 * Charges API. New Stripe accounts cannot enable that API, so this interface
 * isolates every payment call behind a swappable driver:
 *
 *  - StripePaymentsService — current behavior against a Stripe account that
 *    still has the Charges API (test or live mode).
 *  - StubPaymentsService — deterministic in-process fake for the prototype
 *    environments; no external calls.
 *
 * A future PaymentIntents/Elements migration adds a third driver without
 * touching resolvers or webhook processing.
 */

export interface PaymentCharge {
  id: string;
  /** Total amount in cents, including service fee. */
  amount: number;
  /** Unix epoch seconds. */
  created: number;
  captured: boolean;
  refunded: boolean;
  metadata: { [key: string]: string };
}

export interface PaymentWebhookEvent {
  id: string;
  type: string;
  data: {
    object: PaymentCharge;
  };
}

export type CardFunding = 'credit' | 'debit' | 'prepaid' | 'unknown';

export interface CreateChargeArgs {
  /** Total amount in cents. */
  amount: number;
  /** Tokenized card from the client. Never raw card data. */
  cardToken: string;
  description: string;
  /** false = authorize now, capture during fulfillment (birth/marriage). */
  capture: boolean;
  statementDescriptor: string;
  metadata: { [key: string]: string };
}

/**
 * Error shape the resolvers branch on. Matches Stripe error semantics so the
 * Stripe driver can rethrow SDK errors unchanged.
 */
export interface PaymentError extends Error {
  type?: string; // e.g. 'StripeCardError'
  code?: string; // e.g. 'charge_expired_for_capture', 'resource_missing'
}

export default interface PaymentsService {
  createCharge(args: CreateChargeArgs): Promise<PaymentCharge>;
  captureCharge(transactionId: string): Promise<void>;
  retrieveCharge(transactionId: string): Promise<PaymentCharge>;
  refundCharge(transactionId: string): Promise<void>;
  /** Funding is re-derived server-side from the token; never trusted from the client. */
  retrieveTokenFunding(cardToken: string): Promise<CardFunding>;
  /**
   * Verifies the webhook signature and parses the event. MUST throw if the
   * signature is missing or invalid — callers fail closed.
   */
  constructWebhookEvent(rawBody: string, signature: string): PaymentWebhookEvent;
}
