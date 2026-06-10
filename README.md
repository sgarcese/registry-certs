# registry-certs

City of Boston vital-records ordering: residents order **birth, death, and
marriage certificates** (paying by card) and submit **marriage intentions**.

Extracted from the CityOfBoston `digital` monorepo into a self-sufficient
repository and modernized:

| | Legacy (monorepo) | This repo |
|---|---|---|
| Runtime | Node 12 | Node 22 LTS |
| App | Next.js 9 + custom hapi 20 server | Single Next.js 15 app (Pages Router) |
| UI | React 16.8 / MobX 4 / Emotion 10 | React 18 / MobX 6 / Emotion 11 |
| GraphQL | apollo-server-hapi 3 | GraphQL Yoga 5 at `pages/api/graphql.ts` |
| Data | City MSSQL stored procedures | Same proc contract against RDS SQL Server (stubs in `db/migrations/`) |
| Payments | Stripe SDK 5, called directly | `PaymentsService` driver: `stripe` \| `stub` |
| Email | Postmark, called directly | `EmailSender` driver: `postmark` \| `log` |
| Deploy | Lerna + Travis + shared CodeBuild + EC2-ECS | Terraform (`terraform/`) + per-env CodeBuild + Fargate |


## Local development

```sh
npm install
cp .env.sample .env

# Option A: no database — fixture-backed fake (REGISTRY_DATA_DB_SERVER empty)
npm run dev

# Option B: real SQL Server
docker compose up -d db
npm run db:migrate     # creates DBs, tables, 18 stub procs, seed data
npm run dev
```

- App: http://localhost:3000 (redirects to /birth)
- GraphQL (needs `X-API-KEY`): http://localhost:3000/graphql
- Simulate a signed payment webhook:
  `npm run simulate-webhook -- --order-id RG-DC202606-1234567 --order-key 1000`

`npm run typecheck` · `npm test` · `npm run build`

## Architecture

- `pages/` — UI routes + `pages/api/*` (GraphQL, Stripe webhook, uploads,
  marriage-intention relay, healthz). Rewrites in `next.config.js` keep the
  legacy external paths (`/graphql`, `/stripe`, `/upload`) stable.
- `client/` — flows + MobX stores. `server/` — resolvers, RegistryDb (stored
  proc data access), email templates, webhook processing.
- `server/lib/app-services.ts` — boot wiring + driver selection
  (`PAYMENTS_DRIVER`, `EMAIL_DRIVER`, `CONTACT_FORM_DRIVER`).
- `vendor/` — react-fleet and next-client-common, vendored from the monorepo.
- `db/` — migration runner + SQL migrations that recreate the stored-proc
  contract (`Commerce.*`, `Registry.Death.*`, `MarriageRegistry.dbo.*`).
  Pointing at the city's real MSSQL later is a connection-string change.
- `graphql/schema.graphql` — committed SDL (was ts2gql-generated; now
  hand-maintained).

## Deploying

1. **Bootstrap state** (once): `cd terraform/bootstrap && terraform apply`
2. **Shared ECR** (once): `cd terraform/envs/shared && terraform init && terraform apply`
3. **Per environment**: `cd terraform/envs/dev` (or staging/prod), copy
   `terraform.tfvars.sample` → `terraform.tfvars` with your domain/zone/repo,
   then `terraform init && terraform apply`.
4. Fill the per-env secret `registry-certs/<env>/app` in Secrets Manager
   (placeholders are created for you).
5. Push to the trigger branch — `main` → dev, `staging` → staging,
   `production` → prod. CodeBuild tests, builds, pushes ECR, runs
   `db/migrate.ts` inside the VPC, registers an image-only task-def revision,
   and updates the Fargate service (circuit breaker auto-rolls-back).

## Known follow-ups

- **Stripe Charges/Tokens API**: the real-payment driver uses the legacy API,
  which new Stripe accounts cannot enable. A PaymentIntents/Elements migration
  is required before live payments on a new account (isolated behind
  `PaymentsService`).
- **Prod DB HA**: RDS SQL Server Web edition is single-AZ; Multi-AZ requires
  Standard edition.
- **Data migration** from the city's MSSQL into RDS is out of scope here; the
  schema/proc contract was kept compatible to make that a data exercise.
