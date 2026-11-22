# Unikorn360

Practice CRM for small Chartered Accountant and GST firms in Tamil Nadu. One firm is one tenant. Leads, clients, a compliance calendar, and GST invoices live in the same desk.

## Architecture

- **Next.js App Router** (TypeScript, Tailwind, shadcn/ui) on the Node runtime. Authenticated pages read and write through the signed-in Supabase client, so Row Level Security is the real boundary.
- **Supabase** in the Mumbai region (`ap-south-1`) for Postgres, Auth, and Storage. Schema, policies, and the demo firm are in `supabase/migrations` and `supabase/seed.sql`.
- **Cloudflare Workers** via [OpenNext](https://opennext.js.org/cloudflare). Local development uses `next dev`. Deploy uses `wrangler`.
- **Razorpay** subscriptions in test mode. With no keys, an owner can activate a plan locally. Nothing is charged.
- **Domain rules in TypeScript**, covered by Vitest: GSTIN checksum, 18% CGST/SGST vs IGST, and compliance due dates. The due dates are rows in `compliance_rules`, not branches in the app, so a CBIC or CBDT notification is a data change.

```
browser  →  Next.js (server actions, route handlers)
              ├─ anon key + user JWT  → PostgREST / Storage  (RLS)
              └─ service role         → web-to-lead, upload links, Razorpay webhook
```

Tenancy is a `firm_id` on every business table. `app.current_firm_id()` reads the staff profile. Client portal users are a separate principal and can read only their own account. A read-only role can select and cannot insert.

## What is done, and what is stubbed

Done:

- Firm signup, 14-day Growth trial, staff invites, client portal invites
- Roles: owner, partner, staff, read-only
- Leads, contacts, clients, deals with a drag-and-drop pipeline
- Tasks, calls, meetings, notes, and a month calendar
- Custom fields, tags, saved views, global search
- Web-to-lead page that inserts a lead and runs workflows
- Workflow rules for “lead created” and “deal stage changed”
- Email and WhatsApp templates with `{{variables}}`. Click-to-WhatsApp `wa.me` links work
- Dashboard and reports: pipeline, leads by source, conversion, overdue tasks, collections by month
- Client master with PAN, GSTIN checksum, entity type, filing frequency, assigned staff
- Compliance calendar generated from the rules table (GSTR-1, GSTR-3B including the QRMP 22nd/24th split, TDS with a 31 May Q4, advance tax, ITR, AOC-4, MGT-7, LLP Form 8 and 11)
- Document vault paths in Supabase Storage, per financial year, plus token upload links
- Engagements, GST invoices (SAC, CGST/SGST or IGST), receipts, PDF
- Time entries
- Client portal: filings, invoices, documents
- CSV import and export for leads, contacts, and clients
- DPDP-oriented consent fields, contact export, contact anonymisation, firm JSON export, audit log
- Plan limits for seats and clients. Starter ₹999, Growth ₹2,499, Pro ₹5,999
- English UI, Indian dates, IST, `en-IN` currency, Indian mobile checks. Tamil dictionary for navigation

Stubbed:

- **Sending email and WhatsApp.** `MessageAdapter` records the message as `stubbed`. No provider is called. `wa.me` links are real.
- **Razorpay live mode.** The test API is wired. Without keys, checkout is replaced by a clearly labelled local activation. The webhook verifies `X-Razorpay-Signature` when `RAZORPAY_WEBHOOK_SECRET` is set.
- **Google sign-in** is wired in the UI and in `supabase/config.toml`, and stays off until you set the client id and secret.
- **Tamil** covers navigation and a few headings. The rest of the product is English.
- **Full-text search** is `ilike`, which is enough for a 15-person firm.

## Local setup

Requirements: Node 22, Docker, the Supabase CLI.

```bash
npm install
supabase start
```

Copy the anon and service-role keys from `supabase status` into `.env.local`. `.env.example` lists every name. Never commit `.env.local`.

```bash
npm run dev
```

The app listens on [http://127.0.0.1:43123](http://127.0.0.1:43123).

`supabase start` applies migrations and `supabase/seed.sql`. The demo firm is **Kaveri & Co., Chartered Accountants** in Mylapore. It is fictional.

| Who | Email | Password |
| --- | --- | --- |
| Owner | rajesh.iyer@kaveri.test | Kaveri#2026 |
| Partner | priya.subramanian@kaveri.test | Kaveri#2026 |
| Staff | karthik.n@kaveri.test | Kaveri#2026 |
| Staff | divya.mohan@kaveri.test | Kaveri#2026 |
| Read-only | anitha.raman@kaveri.test | Kaveri#2026 |
| Client portal | murugan.textiles@client.test | Portal#2026 |

Magic links are delivered to Mailpit at [http://127.0.0.1:54324](http://127.0.0.1:54324). Password sign-in exists so the seeded firm can be opened without an inbox. The login screen prefills the owner so a local demo is one click.

Regenerate the rules migration or the seed after editing the TypeScript sources:

```bash
npm run rules:sql
npm run seed:sql
supabase db reset
```

### Tests

```bash
npm test
```

That runs GSTIN checksum, GST split, compliance due dates, Indian formatting, and an RLS test against the local database. The RLS test signs in as firm A and asserts it cannot read or write firm B. It rolls the transaction back.

If Docker’s bridge drops traffic between containers, the local stack will fail while initialising. On this kind of VM the fix was `sudo iptables-legacy -P FORWARD ACCEPT`.

## Supabase project in Mumbai

Do this in a new project. Do not point this repo at an existing production project.

1. Create a project at [supabase.com](https://supabase.com) and choose **South Asia (Mumbai)**, region `ap-south-1`.
2. Install the CLI and link it: `supabase link --project-ref <ref>`.
3. Push the schema: `supabase db push`.
4. In Authentication → URL configuration, set the site URL to the deployed app and add `https://<your-domain>/auth/callback`.
5. Copy the project URL and anon key into the host’s environment as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Set `SUPABASE_SERVICE_ROLE_KEY` as a server-only secret.
6. Confirm the `documents` bucket exists (the migration creates it) and that it is private.

Seed data is for local demos. Do not run `supabase/seed.sql` against production.

## Google sign-in

1. In Google Cloud Console, create an OAuth client of type **Web application**.
2. Authorised redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`. For local Supabase add `http://127.0.0.1:54321/auth/v1/callback`.
3. Put the client id and secret in the environment as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Do not commit them.
4. In `supabase/config.toml`, set `[auth.external.google] enabled = true`. `skip_nonce_check` is already true, which local Google sign-in needs.
5. On the hosted project, enable the Google provider in Authentication → Providers and paste the same client id and secret.
6. Restart the local stack: `supabase stop && supabase start`.

The login screen calls `signInWithOAuth({ provider: "google" })`. If the provider is disabled, Supabase returns an error on that button and email sign-in still works.

## Razorpay test mode

Create three test-mode plans in the Razorpay dashboard: ₹999, ₹2,499, and ₹5,999 per month. Then set:

```
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
RAZORPAY_PLAN_STARTER=plan_...
RAZORPAY_PLAN_GROWTH=plan_...
RAZORPAY_PLAN_PRO=plan_...
```

The owner’s subscription screen creates a subscription and redirects to Razorpay’s short URL. Point the webhook at `https://<your-domain>/api/webhooks/razorpay` for `subscription.activated`, `subscription.charged`, `subscription.halted`, and `subscription.cancelled`.

## Cloudflare

Deploy this as a **Worker**, not a Pages site. Pages looks for a `dist` folder and will fail after a normal Next build. `wrangler deploy` also fails with `Could not find compiled Open Next config` if the build command was only `next build`.

In the Workers project settings, leave these exactly as written:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`

`npm run build` runs `opennextjs-cloudflare build`. That adapter compiles Next.js with `npm run build:next` (`next build`), then writes `.open-next/worker.js`. The inner command is set in `open-next.config.ts` as `buildCommand`. It must stay `npm run build:next`. If `build` itself is `opennextjs-cloudflare build` and OpenNext is left on its default (`npm run build`), the builder calls itself until Cloudflare kills it with status 137.

The Worker build already has `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. `npm run build` copies those into a gitignored `.env.production` as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, which is the only form Next.js will inline into the browser. Add `https://crm360.unikorn360.com/auth/callback` to the Supabase auth redirect allow-list before asking anyone to sign in.

`npm run preview:cf` builds and opens a local Workers preview.

## Useful paths

| Path | What it is |
| --- | --- |
| `/dashboard` | Firm desk |
| `/deals` | Pipeline |
| `/compliance` | Filing calendar |
| `/clients/[id]` | Client file |
| `/invoices/[id]` | Tax invoice and PDF |
| `/f/kaveriwebform01` | Demo web-to-lead form |
| `/upload/murugan-bank-oct-2026` | Demo client upload link |
| `/portal` | Client portal |
