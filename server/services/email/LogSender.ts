import crypto from 'crypto';

import EmailSender, { OutgoingEmail } from './EmailSender';

/**
 * Email stub for prototype environments: emits a structured JSON line (picked
 * up by CloudWatch) instead of sending. The recipient address is hashed so
 * delivery can be correlated in tests without logging PII.
 */
export default class LogSender implements EmailSender {
  async send({ to, from, subject, text }: OutgoingEmail): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        event: 'email.stub-delivery',
        toHash: crypto.createHash('sha256').update(to).digest('hex').slice(0, 16),
        from,
        subject,
        textPreview: text.slice(0, 200),
      })
    );
  }
}
