# UNIKORN360 AI Copilot — Verification & Production Rollout Runbook

Repository: `rajasusrog/CRM360` (`main`)
Production URL: `https://crm360.unikorn360.com`
Cloudflare Worker: `crmpro360`
Supabase schemas: `crmpro` (Data API exposed), `crmpro_private` (**excluded from Data API**)
Storage bucket: `crmpro_documents` (private)

---

## 0. Workspace vs. GitHub `main` Reconciliation Note

Before merging or deploying, sync the updated workspace files (including the refreshed `package-lock.json`) cleanly onto `rajasusrog/CRM360` `main` without overwriting files that live only on `main` (`CRMPRO-SETUP.md`, `LOGIN-FIX.md`, `scripts/test-crmpro-db.mjs`, `supabase/config.toml`, `supabase/crmpro-bootstrap.sql`, `supabase/migrations/20261122165839_crmpro_api.sql`, `supabase/seed.sql`).

Because the shared Supabase project had base tables created earlier via SQL Editor (`CRMPRO-SETUP.md`), **never** run `supabase db reset`, import demo seeds, or run an unreviewed `supabase db push` against production.

---

## 1. Local / Staging Disposable Database Verification

Run all database tests against a disposable local PostgreSQL / Supabase database (`supabase start` or Docker `postgres:17`), never against production:

```bash
# Example with Supabase CLI local stack:
supabase start
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f supabase/migrations/20261123100000_ai_copilot.sql
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f supabase/migrations/20261123110000_ai_copilot_atomic.sql
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f supabase/migrations/20261123120000_ai_accounting_trust_boundary.sql
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f supabase/migrations/20261123130000_ai_tokens_and_guard_fix.sql

DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  npx vitest run tests/ai-concurrency-db.test.ts tests/rls.test.ts
```

Or run the reproducible GitHub Actions job in `.github/workflows/verify-db.yml`.

---

## 2. Read-Only Production Inspection SQL (Run FIRST)

Execute this read-only inspection script in the production Supabase SQL Editor before applying any AI migration:

```sql
-- 1) Recorded Supabase CLI migrations
select version, name
from supabase_migrations.schema_migrations
where version >= '20261122000000'
order by version;

-- 2) Required extensions & schemas
select extname, extnamespace::regnamespace::text as schema_name
from pg_extension
where extname in ('pgcrypto');

select nspname
from pg_namespace
where nspname in ('crmpro', 'crmpro_private')
order by nspname;

-- 3) Existing AI tables & key columns
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'crmpro'
  and table_name in ('ai_firm_settings', 'ai_usage_events', 'ai_task_batches', 'ai_feedback')
order by table_name, ordinal_position;

-- 4) RLS enabled & policy count on AI tables
select
  t.tablename,
  t.rowsecurity,
  count(p.policyname) as policy_count
from pg_tables t
left join pg_policies p
  on p.schemaname = t.schemaname and p.tablename = t.tablename
where t.schemaname = 'crmpro'
  and t.tablename in ('ai_firm_settings', 'ai_usage_events', 'ai_task_batches', 'ai_feedback')
group by t.tablename, t.rowsecurity
order by t.tablename;

-- 5) AI RPC signatures & role EXECUTE privileges
select
  p.oid::regprocedure::text as signature,
  has_function_privilege('public', p.oid, 'execute') as public_exec,
  has_function_privilege('anon', p.oid, 'execute') as anon_exec,
  has_function_privilege('authenticated', p.oid, 'execute') as auth_exec,
  has_function_privilege('service_role', p.oid, 'execute') as service_exec
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'crmpro'
  and p.proname in (
    'crmpro_reserve_ai_quota',
    'crmpro_finalize_ai_usage',
    'crmpro_confirm_ai_tasks'
  )
order by p.oid::regprocedure::text;

-- 6) Data API exposure check (authenticator PostgREST search schemas / schema usage)
select
  rolname,
  rolconfig
from pg_roles
where rolname in ('authenticator', 'anon', 'authenticated');

select
  has_schema_privilege('anon', 'crmpro_private', 'usage') as anon_uses_private,
  has_schema_privilege('authenticated', 'crmpro_private', 'usage') as auth_uses_private;
```

Check the output carefully:
- Apply **only** the AI migrations not yet reflected in schema/functions (`20261123100000` through `20261123130000`, in exact numeric order).
- In Supabase Dashboard → **Settings → Data API**, ensure **Exposed schemas** includes `crmpro` and **strictly excludes `crmpro_private`**. Note: `20261122101000_functions_rls.sql` grants SQL `USAGE` on `crmpro_private` to `authenticated` so RLS helper functions work inside queries; keeping `crmpro_private` **out** of PostgREST Exposed schemas ensures `crmpro_private` is never directly callable over HTTP.

---

## 3. Safe Production Migration Procedure

All four AI Copilot SQL migrations contain standard DDL/DML without `CONCURRENTLY` index builds, so each unapplied migration can be wrapped in an explicit transaction (`BEGIN; ... COMMIT;`) inside Supabase SQL Editor (or applied step-by-step via SQL Editor + migration ledger reconciliation):

1. `supabase/migrations/20261123100000_ai_copilot.sql` (creates `ai_firm_settings`, `ai_usage_events`, `ai_task_batches`, `ai_feedback` + RLS)
2. `supabase/migrations/20261123110000_ai_copilot_atomic.sql` (adds atomic RPCs and locks down direct client writes on `ai_usage_events` & `ai_task_batches`)
3. `supabase/migrations/20261123120000_ai_accounting_trust_boundary.sql` (adds `lease_expires_at`, `payload_hash`, lease-bound quota reservation, caller/payload-bound task idempotency, drops legacy 3-arg finalize)
4. `supabase/migrations/20261123130000_ai_tokens_and_guard_fix.sql` (adds `prompt_tokens`, `completion_tokens`, `total_tokens`, drops legacy 5-arg finalize, replaces with 8-arg finalize without misleading `current_user` check, restricts `EXECUTE` solely to `service_role`)

After applying only the missing migrations in SQL Editor, reconcile Supabase CLI migration history (once linked in CI/terminal) without pushing unreviewed SQL:

```bash
supabase migration list
# For each migration verified as applied on production:
supabase migration repair --status applied 20261123100000
supabase migration repair --status applied 20261123110000
supabase migration repair --status applied 20261123120000
supabase migration repair --status applied 20261123130000
```

---

## 4. Post-Migration Verification SQL

Run immediately after rollout:

```sql
-- 1) Confirm all 4 AI tables exist with RLS enabled and updated columns
select table_name, rowsecurity
from pg_tables
where schemaname = 'crmpro'
  and table_name in ('ai_firm_settings', 'ai_usage_events', 'ai_task_batches', 'ai_feedback')
order by table_name;

select column_name
from information_schema.columns
where table_schema = 'crmpro'
  and table_name = 'ai_usage_events'
  and column_name in ('lease_expires_at', 'prompt_tokens', 'completion_tokens', 'total_tokens')
order by column_name;

select column_name
from information_schema.columns
where table_schema = 'crmpro'
  and table_name = 'ai_task_batches'
  and column_name = 'payload_hash';

-- 2) Confirm direct INSERT/UPDATE/DELETE privileges are revoked from anon & authenticated
select
  table_name,
  grantee,
  string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'crmpro'
  and table_name in ('ai_usage_events', 'ai_task_batches')
  and grantee in ('anon', 'authenticated', 'service_role')
group by table_name, grantee
order by table_name, grantee;

-- 3) Confirm exact single overload + EXECUTE boundary on each AI RPC
select
  p.oid::regprocedure::text as signature,
  has_function_privilege('public', p.oid, 'execute') as public_exec,
  has_function_privilege('anon', p.oid, 'execute') as anon_exec,
  has_function_privilege('authenticated', p.oid, 'execute') as auth_exec,
  has_function_privilege('service_role', p.oid, 'execute') as service_exec
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'crmpro'
  and p.proname in (
    'crmpro_reserve_ai_quota',
    'crmpro_finalize_ai_usage',
    'crmpro_confirm_ai_tasks'
  )
order by p.oid::regprocedure::text;
```

Expected privilege matrix:
- `ai_usage_events`, `ai_task_batches`: `authenticated` has `SELECT` only (`anon` has none).
- `crmpro_reserve_ai_quota(text, text, text, integer)`: `public_exec=false`, `anon_exec=false`, `auth_exec=true`, `service_exec=true`.
- `crmpro_confirm_ai_tasks(text, text, uuid, jsonb)`: `public_exec=false`, `anon_exec=false`, `auth_exec=true`, `service_exec=true`.
- `crmpro_finalize_ai_usage(uuid, uuid, uuid, text, integer, integer, integer, integer)`: `public_exec=false`, `anon_exec=false`, `auth_exec=false`, `service_exec=true`, with **zero** older 3-arg or 5-arg overloads remaining.

---

## 5. Rollback / Disable Procedure (Zero Customer Data Loss)

To disable AI Copilot across all firms immediately without deleting CRM tasks, activities, audit logs, or billing data:

```sql
begin;
update crmpro.ai_firm_settings set enabled = false;
revoke all on function crmpro.crmpro_reserve_ai_quota(text, text, text, integer) from authenticated;
revoke all on function crmpro.crmpro_confirm_ai_tasks(text, text, uuid, jsonb) from authenticated;
commit;
```

To restore after investigation, re-grant `EXECUTE` to `authenticated, service_role` on those two RPCs and re-enable from **Settings → AI Copilot** (or remove the `GEMINI_API_KEY` Worker secret to hard-disable provider calls at the Worker edge).

---

## 6. Cloudflare Worker `crmpro360` Configuration

`scripts/capture-build-env.mjs` writes **only** `NEXT_PUBLIC_*` variables into build-time `.env.production`. Server-only secrets must **never** be placed in build variables, committed `.env` files, or `.open-next` build artifacts—they load strictly from Cloudflare Worker runtime bindings (`process.env` populated at request time by `@opennextjs/cloudflare`).

In **Cloudflare Dashboard → Workers & Pages → `crmpro360` → Settings**:

1. **Runtime Variables and Secrets** (Runtime only):
   - Add **Secret** (`Encrypt`): `GEMINI_API_KEY`
   - Add **Secret** (`Encrypt`): `SUPABASE_SERVICE_ROLE_KEY`
   - Add **Variable**: `GEMINI_MODEL` = `gemini-4-hydrogen`
   - Add **Variable**: `NEXT_PUBLIC_APP_URL` = `https://crm360.unikorn360.com`
   - Confirm existing Supabase/Razorpay/Google OAuth runtime vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, etc.) are present.
2. **Builds → Build configuration → Environment variables** (Build-time only):
   - Include only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL=https://crm360.unikorn360.com`, and `NEXT_PUBLIC_DEMO_MODE=false` (if set).
   - Remove any `GEMINI_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY` from **Build** environment variables if present.
3. Verify Gemini API key access to `gemini-4-hydrogen` locally (never commit keys):
   ```bash
   GEMINI_API_KEY="<local-key>" GEMINI_MODEL="gemini-4-hydrogen" \
     node --experimental-strip-types scripts/smoke-ai-copilot.ts
   ```

---

## 7. Honest Cost-Limit Policy

- **Daily firm quotas (`25` Starter/Cancelled, `150` Growth/Trialing, `500` Pro) count completed `ok` responses plus active unexpired 2-minute leases (`reserved`), not provider spend.**
- Provider failures (`provider_error`), schema/JSON validation failures (`validation_error`), and late/aborted runs (`aborted`) release the daily response slot so users are not penalized on their daily allowance, but **still count toward the 10-per-10-minute burst limit and can still incur Google Gemini token charges**.
- `crmpro.ai_usage_events` logs `prompt_tokens`, `completion_tokens`, and `total_tokens` (whenever returned by Gemini `usageMetadata`) across all finalized outcomes (`ok`, `aborted`, `provider_error`, `validation_error`), and **Settings → AI Copilot** reports completed responses vs. total attempts and logged tokens today.
- **Google Cloud Billing Budgets & Alerts send email/Pub/Sub notifications after threshold crossings; they do NOT act as a hard spend cap.** To enforce hard upstream caps, configure API project rate/token quotas in Google Cloud / AI Studio and/or rotate or remove the `GEMINI_API_KEY` secret.

---

## 8. Post-Deploy Production Smoke Test (Strictly Synthetic Data)

1. Sign in to `https://crm360.unikorn360.com` as the **firm owner** or partner.
2. Open **Settings → AI Copilot**:
   - Confirm the notice accurately states that CRM fields/notes **may contain confidential or personal information** (never describes them as "non-sensitive") and explains response quotas vs. attempt/token tracking.
   - Enable AI Copilot for the firm.
3. Create a clearly synthetic test client (e.g., `Synthetic Verification Traders Pvt Ltd`, city `Vellore`) with one synthetic note. Never transmit real customer PII during smoke testing.
4. On that synthetic client's detail page:
   - Run **AI Briefing** → confirm all links cite exact `[sourceKey]` CRM records and match only facts in the synthetic dossier.
   - Run **Follow-up Draft** → confirm grounded draft output without invented amounts or dates.
   - Run **Notes to Tasks** → confirm one proposed task, then intentionally click/trigger the same confirmation again (or inspect network/UI retry) and confirm **strictly one** CRM task activity was created.
5. Reopen **Settings → AI Copilot** and verify **Completed today**, **Total attempts**, and **Tokens logged** reflect the exact synthetic runs. Delete or archive the synthetic test client afterward.
