/* eslint no-console: 0 */

/**
 * Posts a properly SIGNED payment webhook event to the app, so the
 * fail-closed signature verification path is exercised end-to-end even in
 * stub mode.
 *
 * Usage:
 *   STRIPE_WEBHOOK_SECRET=... npm run simulate-webhook -- \
 *     --type charge.succeeded \
 *     --charge ch_stub_abc123 \
 *     --order-id RG-DC202606-1234567 \
 *     --order-key 1000 \
 *     --order-type DC \
 *     --amount 1456 \
 *     [--url http://localhost:3000/stripe] [--captured] [--bad-signature]
 */

import crypto from 'crypto';
import dotenv from 'dotenv';

import { computeStripeStyleSignature } from '../server/services/payments/StubPaymentsService';

dotenv.config();

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && process.argv[i + 1]) {
    return process.argv[i + 1];
  }
  if (fallback !== undefined) {
    return fallback;
  }
  throw new Error(`Missing required argument --${name}`);
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('STRIPE_WEBHOOK_SECRET must be set');
  }

  const type = arg('type', 'charge.succeeded');
  const url = arg('url', 'http://localhost:3000/stripe');

  const event = {
    id: `evt_sim_${crypto.randomBytes(6).toString('hex')}`,
    type,
    data: {
      object: {
        id: arg('charge', `ch_stub_${crypto.randomBytes(6).toString('hex')}`),
        amount: parseInt(arg('amount', '1456'), 10),
        created: Math.floor(Date.now() / 1000),
        captured: flag('captured') || type === 'charge.captured',
        refunded: false,
        metadata: {
          'webapp.name': 'registry-certs',
          'webapp.nodeEnv': process.env.NODE_ENV || 'production',
          'order.orderId': arg('order-id'),
          'order.orderKey': arg('order-key'),
          'order.orderType': arg('order-type', 'DC'),
        },
      },
    },
  };

  const body = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = flag('bad-signature')
    ? `t=${timestamp},v1=deadbeef`
    : `t=${timestamp},v1=${computeStripeStyleSignature(body, timestamp, secret)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': signature,
    },
    body,
  });

  console.log(`${type} -> ${url}`);
  console.log(`HTTP ${res.status}: ${await res.text()}`);

  process.exit(res.ok || flag('bad-signature') ? 0 : 1);
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
