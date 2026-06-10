/* eslint no-console: 0 */

/**
 * Boot-time service wiring for the Next API routes. Replaces the hapi
 * server.ts from the monorepo. Built lazily on first request and shared
 * across routes via a module-level singleton (API routes run in one Node
 * process under `next start`).
 *
 * Driver selection (prototype-friendly):
 *   PAYMENTS_DRIVER     stripe | stub      (default: stripe if STRIPE_SECRET_KEY is set, else stub)
 *   EMAIL_DRIVER        postmark | log     (default: postmark if POSTMARK_SERVER_API_TOKEN is set, else log)
 *   CONTACT_FORM_DRIVER bostongov | stub   (default: bostongov if CONTACTFORM_TOKEN is set, else stub)
 *   Registry DB         real MSSQL if REGISTRY_DATA_DB_SERVER is set, else fixture-backed fake
 */

import Rollbar from 'rollbar';

import {
  makeRegistryDbFactory,
  makeFixtureRegistryDbFactory,
  RegistryDbFactory,
} from '../services/RegistryDb';

import Emails from '../services/Emails';
import { makeEmailTemplates } from '../email/EmailTemplates';

import PaymentsService from '../services/payments/PaymentsService';
import StripePaymentsService from '../services/payments/StripePaymentsService';
import StubPaymentsService from '../services/payments/StubPaymentsService';

import EmailSender from '../services/email/EmailSender';
import PostmarkSender from '../services/email/PostmarkSender';
import LogSender from '../services/email/LogSender';

import ContactFormService from '../services/contact/ContactFormService';
import BostonGovContactFormService from '../services/contact/BostonGovContactFormService';
import StubContactFormService from '../services/contact/StubContactFormService';

import { DatabaseConnectionOptions } from './mssql';
import { toBoolean } from '../../utils/helpers';

import { Source } from '../graphql';

type RegistryDbFactoryLike = Pick<RegistryDbFactory, 'registryDb' | 'cleanup'>;

export interface AppServices {
  rollbar: Rollbar;
  registryDbFactory: RegistryDbFactoryLike;
  payments: PaymentsService;
  emails: Emails;
  contactForm: ContactFormService;
  apiKeys: { [key: string]: { source: Source } };
}

function makeRollbar(): Rollbar {
  return new Rollbar({
    accessToken: process.env.ROLLBAR_ACCESS_TOKEN || '',
    enabled: !!process.env.ROLLBAR_ACCESS_TOKEN,
    captureUncaught: true,
    captureUnhandledRejections: true,
    payload: {
      environment: process.env.ROLLBAR_ENVIRONMENT || process.env.NODE_ENV,
    },
    // Defense-in-depth against PII reaching the error tracker.
    scrubFields: [
      'contactEmail',
      'confirmContactEmail',
      'contactPhone',
      'cardToken',
      'password',
    ],
  });
}

function makePayments(): PaymentsService {
  const driver =
    process.env.PAYMENTS_DRIVER ||
    (process.env.STRIPE_SECRET_KEY ? 'stripe' : 'stub');

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

  switch (driver) {
    case 'stripe':
      return new StripePaymentsService(
        process.env.STRIPE_SECRET_KEY!,
        webhookSecret
      );
    case 'stub':
      return new StubPaymentsService(webhookSecret);
    default:
      throw new Error(`Unknown PAYMENTS_DRIVER: ${driver}`);
  }
}

function makeEmailSender(): EmailSender {
  const driver =
    process.env.EMAIL_DRIVER ||
    (process.env.POSTMARK_SERVER_API_TOKEN ? 'postmark' : 'log');

  switch (driver) {
    case 'postmark':
      return new PostmarkSender(process.env.POSTMARK_SERVER_API_TOKEN!);
    case 'log':
      return new LogSender();
    default:
      throw new Error(`Unknown EMAIL_DRIVER: ${driver}`);
  }
}

function makeContactForm(): ContactFormService {
  const driver =
    process.env.CONTACT_FORM_DRIVER ||
    (process.env.CONTACTFORM_TOKEN ? 'bostongov' : 'stub');

  switch (driver) {
    case 'bostongov':
      return new BostonGovContactFormService(
        process.env.CONTACTFORM_TOKEN!,
        process.env.CONTACTFORM_CONTENT_TYPE || ''
      );
    case 'stub':
      return new StubContactFormService();
    default:
      throw new Error(`Unknown CONTACT_FORM_DRIVER: ${driver}`);
  }
}

function makeApiKeys(): AppServices['apiKeys'] {
  const apiKeys: AppServices['apiKeys'] = {};

  if (process.env.API_KEYS) {
    process.env.API_KEYS.split(',')
      .filter(k => !!k)
      .forEach(k => {
        apiKeys[k] = { source: 'unknown' };
      });
  }

  if (process.env.WEB_API_KEY) {
    apiKeys[process.env.WEB_API_KEY] = { source: 'web' };
  }

  if (process.env.FULFILLMENT_API_KEY) {
    apiKeys[process.env.FULFILLMENT_API_KEY] = { source: 'fulfillment' };
  }

  return apiKeys;
}

async function buildServices(): Promise<AppServices> {
  const rollbar = makeRollbar();

  const encryption = process.env.ENCRYPT_DB_CONNECTION
    ? toBoolean(process.env.ENCRYPT_DB_CONNECTION, true).value
    : true;
  const multiSubnetFailover = process.env.USE_MULTISUBNETFAILOVER
    ? toBoolean(process.env.USE_MULTISUBNETFAILOVER, false).value
    : false;

  // These env variables are named "DATA" for historical reasons.
  const dbOpts: DatabaseConnectionOptions = {
    username: process.env.REGISTRY_DATA_DB_USER!,
    password: process.env.REGISTRY_DATA_DB_PASSWORD!,
    domain: process.env.REGISTRY_DATA_DB_DOMAIN,
    server: process.env.REGISTRY_DATA_DB_SERVER!,
    database: process.env.REGISTRY_DATA_DB_DATABASE!,
    encryption,
    multiSubnetFailover,
  };

  const registryDbFactory = dbOpts.server
    ? await makeRegistryDbFactory(rollbar, dbOpts)
    : await makeFixtureRegistryDbFactory('fixtures/registry-data/smith.json');

  const emails = new Emails(
    makeEmailSender(),
    rollbar,
    await makeEmailTemplates()
  );

  return {
    rollbar,
    registryDbFactory,
    payments: makePayments(),
    emails,
    contactForm: makeContactForm(),
    apiKeys: makeApiKeys(),
  };
}

declare global {
  // eslint-disable-next-line no-var
  var __registryCertsServices: Promise<AppServices> | undefined;
}

export function getAppServices(): Promise<AppServices> {
  // globalThis (rather than a module local) survives Next dev-mode module
  // re-evaluation, keeping one DB pool per process.
  if (!globalThis.__registryCertsServices) {
    globalThis.__registryCertsServices = buildServices().catch(err => {
      // Allow a retry on the next request rather than caching the failure.
      globalThis.__registryCertsServices = undefined;
      throw err;
    });
  }

  return globalThis.__registryCertsServices;
}

/**
 * Resolves the API-key header to a request source — and *fails closed*: if no
 * API keys are configured at all, every keyed request is rejected unless
 * ALLOW_UNAUTHENTICATED_GRAPHQL=1 is set explicitly (local development only).
 * The legacy server defaulted to `auth: false` in that case.
 */
export function resolveSource(
  apiKeys: AppServices['apiKeys'],
  headerValue: string | string[] | undefined
): Source | null {
  if (Object.keys(apiKeys).length === 0) {
    return process.env.ALLOW_UNAUTHENTICATED_GRAPHQL === '1' &&
      process.env.NODE_ENV !== 'production'
      ? 'unknown'
      : null;
  }

  const key = Array.isArray(headerValue) ? headerValue[0] : headerValue;

  if (!key || !apiKeys[key]) {
    return null;
  }

  return apiKeys[key].source;
}
