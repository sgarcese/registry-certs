/**
 * Driver abstraction over the boston.gov contact-form relay used by the
 * marriage-intention flow for its confirmation email.
 */
export default interface ContactFormService {
  /**
   * Sends the (already whitelisted/validated) form payload. Returns the
   * upstream response body, which the client surfaces.
   */
  send(payload: { [key: string]: string }): Promise<unknown>;
}
