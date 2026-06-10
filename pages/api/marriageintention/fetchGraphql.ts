import { NextApiRequest, NextApiResponse } from 'next';

import {
  getAppServices,
  resolveSource,
} from '../../../server/lib/app-services';

/**
 * Relays the marriage-intention confirmation email through the boston.gov
 * contact-form API (exposed externally as /marriageintention/fetchGraphql via
 * a rewrite, the path the client has always used).
 *
 * Hardened vs. the legacy hapi route, which was an unauthenticated open proxy
 * that attached the server's CONTACTFORM_TOKEN to arbitrary payloads:
 *  - requires a valid X-API-KEY (the web app's key)
 *  - whitelists payload fields; everything else is dropped
 *  - pins sender + template id server-side
 *  - never logs the payload (applicant PII)
 */

const ALLOWED_FIELDS = [
  'email[to_address]',
  'email[from_address]',
  'email[subject]',
  'email[message]',
  'email[name]',
] as const;

const PINNED_FIELDS: { [key: string]: string } = {
  'email[sender]': 'City of Boston Registry',
  'email[template_id]': '20558627',
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  const services = await getAppServices();

  const source = resolveSource(services.apiKeys, req.headers['x-api-key']);

  if (source === null) {
    res.status(401).json({ message: 'A valid X-API-KEY header is required' });
    return;
  }

  const body: { [key: string]: unknown } = req.body || {};

  const payload: { [key: string]: string } = { ...PINNED_FIELDS };

  for (const field of ALLOWED_FIELDS) {
    const value = body[field];
    if (typeof value === 'string') {
      payload[field] = value;
    }
  }

  if (!payload['email[to_address]'] || !payload['email[message]']) {
    res.status(422).json({ message: 'Missing required email fields' });
    return;
  }

  try {
    const result = await services.contactForm.send(payload);
    res.status(200).json(result == null ? { status: 'ok' } : result);
  } catch (e) {
    services.rollbar.error(e as any, req);
    res.status(502).json({ message: 'Could not send confirmation email' });
  }
}
