import { NextApiRequest, NextApiResponse } from 'next';

import { getAppServices } from '../../server/lib/app-services';
import { processStripeEvent } from '../../server/stripe-events';

export const config = {
  api: {
    // Signature verification requires the exact raw body bytes.
    bodyParser: false,
  },
};

function readRawBody(req: NextApiRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

/**
 * Payment-processor webhook (exposed externally as /stripe via a rewrite).
 * Used to reliably complete the order process when charges succeed.
 *
 * FAIL-CLOSED: every event must carry a valid signature. The legacy handler
 * fell back to trusting `JSON.parse(body)` when STRIPE_WEBHOOK_SECRET was
 * unset, letting a forged charge.succeeded mark orders as paid. The payments
 * drivers refuse to construct without a secret, and verification errors are
 * rejected here with a 400.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  const services = await getAppServices();
  const body = await readRawBody(req);

  const signature = req.headers['stripe-signature'];

  if (!signature || Array.isArray(signature)) {
    res.status(400).send('Missing webhook signature');
    return;
  }

  try {
    await processStripeEvent(
      {
        registryDb: services.registryDbFactory.registryDb(),
        payments: services.payments,
        emails: services.emails,
      },
      signature,
      body
    );

    res.status(200).send('');
  } catch (e) {
    if ((e as Error).message.match(/signature/i)) {
      // Bad signature: reject, and don't ask Stripe to retry.
      res.status(400).send('Webhook signature verification failed');
      return;
    }

    // Processing failure: 500 so Stripe retries the event.
    services.rollbar.error(e as any, req);
    res.status(500).send('Webhook processing failed');
  }
}
