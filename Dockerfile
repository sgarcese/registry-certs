# Build and run the registry-certs Next.js app (standalone output).

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

RUN addgroup -S app && adduser -S app -G app

# Standalone server + static assets.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

# Runtime file reads that Next's file tracing can't see (resolved from
# process.cwd() — see server/util.ts): GraphQL SDL, persisted fulfillment
# queries, email templates, and the fixture data for the no-DB fallback.
COPY --from=build /app/graphql ./graphql
COPY --from=build /app/server/queries ./server/queries
COPY --from=build /app/server/email ./server/email
COPY --from=build /app/fixtures ./fixtures

USER app
EXPOSE 3000

CMD ["node", "server.js"]
