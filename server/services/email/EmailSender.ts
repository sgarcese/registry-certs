/**
 * Driver abstraction over transactional email delivery.
 *
 *  - PostmarkSender — real delivery via Postmark.
 *  - LogSender — structured log to stdout/CloudWatch for the prototype
 *    environments; no external calls, no recipient PII beyond a hash.
 */
export interface OutgoingEmail {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
}

export default interface EmailSender {
  send(email: OutgoingEmail): Promise<void>;
}
