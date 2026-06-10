// @ts-check

/**
 * Replaces the old hapi-hosted setup from the monorepo
 * (services-js/registry-certs/server/server.ts). Routing that used to live in
 * hapi routes is expressed here as redirects/rewrites; the route logic itself
 * lives in pages/api/*.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  // Read at server boot, so one image serves every environment.
  publicRuntimeConfig: {
    graphqlPath: '/graphql',
    graphqlApiKey: process.env.WEB_API_KEY || '',
    stripePublishableKey:
      process.env.STRIPE_PUBLISHABLE_KEY || 'fake-stripe-key',
  },

  async redirects() {
    return [
      {
        source: '/',
        destination: process.env.ROOT_REDIRECT_URL || '/birth',
        permanent: false,
      },
    ];
  },

  async rewrites() {
    // Keep the externally-known paths (Stripe webhook config, client DAOs,
    // fulfillment integrations) stable while the handlers live under /api.
    return [
      { source: '/graphql', destination: '/api/graphql' },
      { source: '/stripe', destination: '/api/stripe' },
      { source: '/upload', destination: '/api/upload' },
      {
        source: '/marriageintention/fetchGraphql',
        destination: '/api/marriageintention/fetchGraphql',
      },
      { source: '/admin/ok', destination: '/api/healthz' },
    ];
  },

  webpack: config => {
    // react-fleet imports boston.gov header/footer/navigation chrome as raw
    // HTML strings.
    config.module.rules.push({
      test: /\.html$/,
      type: 'asset/source',
    });

    return config;
  },
};

module.exports = nextConfig;
