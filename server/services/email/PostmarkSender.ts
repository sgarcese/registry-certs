import { ServerClient } from 'postmark';

import EmailSender, { OutgoingEmail } from './EmailSender';

export default class PostmarkSender implements EmailSender {
  private client: ServerClient;

  constructor(serverApiToken: string) {
    this.client = new ServerClient(serverApiToken);
  }

  async send({ to, from, subject, html, text }: OutgoingEmail): Promise<void> {
    await this.client.sendEmail({
      To: to,
      From: from,
      Subject: subject,
      HtmlBody: html,
      TextBody: text,
    });
  }
}
