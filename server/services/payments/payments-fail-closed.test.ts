import StubPaymentsService, {
  computeStripeStyleSignature,
} from './StubPaymentsService';
import StripePaymentsService from './StripePaymentsService';

/**
 * The Critical finding in the legacy app was a webhook that trusted
 * unverified bodies when no webhook secret was configured. These tests pin
 * the fail-closed behavior of both payment drivers.
 */

const SECRET = 'whsec_test_secret';

function signedHeaders(body: string) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = computeStripeStyleSignature(body, timestamp, SECRET);
  return `t=${timestamp},v1=${signature}`;
}

describe('fail-closed construction', () => {
  it('stub driver refuses to construct without a webhook secret', () => {
    expect(() => new StubPaymentsService('')).toThrow(/WEBHOOK_SECRET/);
  });

  it('stripe driver refuses to construct without a webhook secret', () => {
    expect(() => new StripePaymentsService('sk_test_x', '')).toThrow(
      /WEBHOOK_SECRET/
    );
  });
});

describe('stub driver webhook verification', () => {
  const body = JSON.stringify({
    id: 'evt_1',
    type: 'charge.succeeded',
    data: { object: { id: 'ch_1', metadata: {} } },
  });

  it('accepts a correctly signed event', () => {
    const payments = new StubPaymentsService(SECRET);

    const event = payments.constructWebhookEvent(body, signedHeaders(body));

    expect(event.type).toEqual('charge.succeeded');
  });

  it('rejects a missing signature', () => {
    const payments = new StubPaymentsService(SECRET);

    expect(() => payments.constructWebhookEvent(body, '')).toThrow(
      /signature/i
    );
  });

  it('rejects a forged signature', () => {
    const payments = new StubPaymentsService(SECRET);

    expect(() =>
      payments.constructWebhookEvent(body, 't=12345,v1=deadbeef')
    ).toThrow(/signature/i);
  });

  it('rejects a body that was tampered with after signing', () => {
    const payments = new StubPaymentsService(SECRET);
    const headers = signedHeaders(body);

    const tampered = body.replace('ch_1', 'ch_2');

    expect(() => payments.constructWebhookEvent(tampered, headers)).toThrow(
      /signature/i
    );
  });
});
