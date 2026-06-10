import ContactFormService from './ContactFormService';

/**
 * Contact-form stub for prototype environments: logs that a confirmation was
 * requested (without the PII payload) and reports success.
 */
export default class StubContactFormService implements ContactFormService {
  async send(payload: { [key: string]: string }): Promise<unknown> {
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        event: 'contact-form.stub-delivery',
        fieldCount: Object.keys(payload).length,
      })
    );

    return { status: 'ok', stub: true };
  }
}
