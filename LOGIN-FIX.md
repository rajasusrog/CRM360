# Login redirect repair

## What was fixed

- Removed login's automatic redirect based on a cached browser session. That can disagree with server-side authentication and bounce forever.
- Password login now visits `/auth/continue`, where the server chooses the dashboard, portal or onboarding from verified identity and membership.
- Missing/inaccessible firm rows and database lookup errors stop at `/auth/problem`, rather than cycling between onboarding/dashboard or portal/dashboard.
- Registration requiring email confirmation no longer navigates to a protected page without a session.
- Malformed callbacks stop at login; callback return paths reject backslashes and external-path forms.
- Demo account details are hidden unless `NEXT_PUBLIC_ENABLE_DEMO=true` was set at build time. This setting does NOT create accounts.
- Removed the hardcoded app-domain fallback. Set the actual deployment origin explicitly.
- Repaired the uploaded lockfile's missing optional-platform entries so clean installation is reproducible.

These defects were found in source. The exact live trigger has not been established from authenticated production logs. No production settings, database or deployment was changed. Earlier security-review findings are outside this focused login repair.

## Apply in Cursor / GitHub

1. Back up or commit your current project.
2. Copy this repaired source into the SAME project (or apply `redirect-fix.patch`). Do not nest the source folder inside your app directory.
3. Review the diff and commit. Preserve any newer work not present in the uploaded ZIP.
4. In the Cloudflare Worker, confirm the correct Supabase project URL and public client key are supplied for both build and runtime where required. Use one project consistently across browser and server. Never put the service-role key in a `NEXT_PUBLIC_*` variable.
5. Set `NEXT_PUBLIC_APP_URL=https://crmpro360.unikorn360.com` if that is your chosen live address. If you choose another address, use that address consistently. The screenshot's domain differs from older README examples.
6. Supabase → Authentication → URL Configuration: set Site URL to the chosen origin and add its `/auth/callback` URL to the redirect allow-list. Keep local/preview URLs explicit and separate.
7. Confirm the project's migrations are applied and that the real test user has the right profile/client membership and readable firm. Do not reset production or import the local seed into it.
8. Rebuild with `npm run build` and deploy via the existing Worker pipeline. Test in a fresh private browser window first.

## Demo setup

The original login displayed fictional `*.test` users and passwords. They work only in a database where those synthetic users and associated firm data actually exist. The landing-page link previously labelled 'demo' only opened login.

For a public demo, use a separate Supabase project containing synthetic data; configure demo access and `NEXT_PUBLIC_ENABLE_DEMO=true` only there, then rebuild. Do not expose shared demo credentials against real customer data. This repair does not provision a hosted demo.

## If login still fails

- If the password is rejected: verify the user exists in the same Supabase project used by this deployment.
- If login returns to the stable login page: inspect cookie persistence, HTTPS/domain settings and browser/server Supabase configuration. The repair deliberately does not trust cached browser tokens as proof of server access.
- If `/auth/problem` appears: inspect Worker logs for sanitized `Session lookup failed` stage/codes, verify migrations and firm/profile visibility. Repair the underlying data/policy/configuration; do not bypass RLS with an admin client for normal page access.
- Do not paste cookies, JWTs, passwords or service-role keys into chat or public logs.

## Verification

`tests/auth-routing.test.ts` and `tests/session.test.ts` cover routing and server guards with synthetic/mocked states. They do not prove live Supabase authentication or tenant isolation. Run the original database tests on an isolated local database with `psql` and migrations available.

Use `npm ci`, `npm run build`, and `npm test`. The baseline repository has unrelated lint findings; inspect those separately rather than treating a successful build as release readiness.

Verified on 22 November 2026: clean dependency installation succeeded; all 35 non-database tests passed; the full Cloudflare/OpenNext build completed successfully. Database policy tests and hosted login/demo were not verified.
