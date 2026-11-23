# CRMPro namespace setup

This is a fresh CRM installation in a shared Supabase project, not a rename of existing app tables.

- CRM data: 30 tables in `crmpro`, including `crmpro.profiles` and `crmpro.firms`.
- Private functions: `crmpro_private`. Never add this schema to Data API exposure.
- API: `crmpro.crmpro_create_firm`, `crmpro.crmpro_accept_invite`, `crmpro.crmpro_accept_portal_invite`.
- Storage: private `crmpro_documents` bucket. CRM-scoped policies protect it even if another app has permissive storage policies.
- Authentication: existing Supabase Auth users are reused, but CRM membership is separate. No existing users are assigned to a firm automatically.

## Install

Verify the intended project and that `crmpro`, `crmpro_private` and `crmpro_documents` do not already exist. Take/confirm a recoverable backup appropriate to the project. The reviewed `supabase/crmpro-bootstrap.sql` wraps all four migration scripts in one transaction and fails on an existing namespace. Run it once in the intended project. It creates no demo users and imports no customer data. Do not reset, seed, drop or replace existing public tables.

For a completely fresh local project, use the versioned migrations with the Supabase CLI. The three original migration files in this unreleased branch have been adapted to the new namespace; this is not an upgrade path for a database that already applied the original unprefixed CRM migrations.

A manual SQL-editor bootstrap does not register CLI migration history. Before adopting automated `db push`, reconcile the four applied migration versions through the CLI's documented migration-repair flow on the explicitly selected project. Do not rerun the bootstrap or repair unrelated migration history.

Add **only `crmpro`** to Supabase Data API exposed schemas, retaining all existing entries. Tables are protected by RLS and anon has no table access. The app's browser/server/admin clients all use `db.schema = crmpro`. Keep the shared Site URL and existing redirect URLs; ensure the CRM callback is explicitly allowed.

Confirm Cloudflare build and runtime use the same project URL/public key. Set `NEXT_PUBLIC_APP_URL=https://crmpro360.unikorn360.com` and leave `NEXT_PUBLIC_ENABLE_DEMO=false`. Never expose the service-role key in a public variable. Rebuild and deploy the Worker after code review and successful checks.

Sign in with a real account, create a CRM firm through onboarding, then verify persistence after sign-out/sign-in, staff/client permissions and tenant isolation. A table namespace is not a separate Auth service, compute pool, service-role key or backup boundary.

## Verification

`npm run test:db:isolated` runs PostgreSQL in an isolated PGlite engine with minimal Supabase Auth/Storage fixtures. It applies all migration scripts, checks all 30 RLS tables, public-table/grant preservation, onboarding RPC, two-tenant read/write isolation, tenant foreign keys, staff invitation restrictions, partner self-promotion denial, readonly writes, and bucket isolation despite a permissive unrelated-app policy. It does not emulate the hosted Auth or Storage HTTP services.

`npm test -- --exclude tests/rls.test.ts` covers 35 non-database tests. The original `tests/rls.test.ts` now selects the CRM namespace; it needs psql and a dedicated local Supabase database. Never point that fixture test at a shared production project.

After hosted installation, check table/RLS counts and anonymous grants. Compare existing public-schema structure and profile count to preflight results. Exercise a rollback-only onboarding/tenant smoke test before enabling customer use. Live login and Cloudflare deployment are separate checks.

## Hosted verification status — 22 November 2026

The bootstrap was applied through the SQL Editor with its additional RLS safeguard enabled. Verified afterward: 30 CRM tables, all 30 with RLS, zero anonymous-readable CRM tables and a private bucket. The existing public schema fingerprint, public-table count and profile count matched the preflight. A hosted rollback-only test passed onboarding RPC, two-tenant read/write isolation and cross-tenant owner-reference rejection; test records were rolled back.

The dashboard change to expose **only `crmpro`**, retaining the already exposed schemas and excluding `crmpro_private`, is prepared but not saved: automatic approval review requires explicit approval for this API access change. Until saved, the app cannot use the new namespace through the hosted Data API. Hosted browser login, the Worker project settings, successful Cloudflare deployment and CLI migration-history reconciliation are still pending.
