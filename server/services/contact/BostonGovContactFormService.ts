import axios from 'axios';
import qs from 'qs';

import ContactFormService from './ContactFormService';

const CONTACT_FORM_URL = 'https://www.boston.gov/rest/email/registry';

export default class BostonGovContactFormService
  implements ContactFormService {
  private token: string;
  private contentType: string;

  constructor(token: string, contentType: string) {
    if (!token) {
      throw new Error(
        'CONTACTFORM_TOKEN must be set when using the boston.gov contact-form driver'
      );
    }

    this.token = token;
    this.contentType = contentType || 'application/x-www-form-urlencoded';
  }

  async send(payload: { [key: string]: string }): Promise<unknown> {
    const response = await axios({
      method: 'post',
      url: CONTACT_FORM_URL,
      headers: {
        Authorization: this.token,
        'Content-Type': this.contentType,
      },
      data: qs.stringify(payload),
    });

    // Note: do not log the payload or response — it contains applicant PII.
    return response.data;
  }
}
