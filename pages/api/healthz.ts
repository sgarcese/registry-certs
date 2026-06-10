import { NextApiRequest, NextApiResponse } from 'next';

/**
 * ALB target-group health check (also reachable at /admin/ok via rewrite for
 * parity with the legacy hapi adminOkRoute).
 */
export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.status(200).send('ok');
}
