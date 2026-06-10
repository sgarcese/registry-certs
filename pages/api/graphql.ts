import fs from 'fs';
import path from 'path';

import { NextApiRequest, NextApiResponse } from 'next';
import { createYoga, createGraphQLError, Plugin } from 'graphql-yoga';

import schema, { Context } from '../../server/graphql';
import { getAppServices, resolveSource } from '../../server/lib/app-services';
import { PACKAGE_SRC_ROOT } from '../../server/util';

export const config = {
  api: {
    // Yoga parses the request body itself.
    bodyParser: false,
  },
};

/**
 * The fulfillment integration posts `{ id: "<name>", variables: {...} }`
 * where <name> is a file in server/queries/fulfillment/. Mirrors the
 * legacy persistentQueryPlugin from @cityofboston/hapi-common.
 */
function loadPersistedQueries(): { [id: string]: string } {
  const queriesDir = path.resolve(
    PACKAGE_SRC_ROOT,
    'server',
    'queries',
    'fulfillment'
  );

  const queries: { [id: string]: string } = {};

  for (const p of fs.readdirSync(queriesDir)) {
    const m = p.match(/(.*)\.graphql$/);
    if (m) {
      queries[m[1]] = fs.readFileSync(path.resolve(queriesDir, p), 'utf-8');
    }
  }

  return queries;
}

const persistedQueries = loadPersistedQueries();

const persistedQueriesPlugin: Plugin = {
  onParams({ params, setParams }) {
    const id = (params as { id?: string }).id;

    if (id) {
      const query = persistedQueries[id];

      if (!query) {
        throw createGraphQLError(`Could not find query with id ${id}`, {
          extensions: { http: { status: 404 } },
        });
      }

      setParams({ ...params, query });
    }
  },
};

const yoga = createYoga<
  { req: NextApiRequest; res: NextApiResponse },
  Context
>({
  schema,
  graphqlEndpoint: '/api/graphql',
  graphiql: process.env.NODE_ENV !== 'production',
  // Same-origin only; the legacy `cors: true` (any origin) was a finding.
  cors: false,
  plugins: [persistedQueriesPlugin],
  context: async ({ req }): Promise<Context> => {
    const services = await getAppServices();

    return {
      registryDb: services.registryDbFactory.registryDb(),
      payments: services.payments,
      emails: services.emails,
      rollbar: services.rollbar,
      source: (req as any).__source,
    };
  },
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const services = await getAppServices();

  // Fails closed: no configured keys (or a bad/missing key) means 401, never
  // an open endpoint. (Legacy behavior defaulted to auth:false when no keys
  // were configured.)
  const source = resolveSource(services.apiKeys, req.headers['x-api-key']);

  if (source === null) {
    res.status(401).json({ message: 'A valid X-API-KEY header is required' });
    return;
  }

  (req as any).__source = source;

  try {
    return await yoga(req, res);
  } catch (e) {
    services.rollbar.error(e as any, req);
    throw e;
  }
}
