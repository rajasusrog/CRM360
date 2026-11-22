import { writeFileSync } from "node:fs";
import { generateFilings } from "../src/lib/compliance/generate.ts";
import { SYSTEM_RULES } from "../src/lib/compliance/rules.ts";
import type { ComplianceClient } from "../src/lib/compliance/types.ts";
import { paiseToRupees, rupeesToPaise, splitGst } from "../src/lib/gst/tax.ts";

const firm = "a0000000-0000-4000-8000-000000000001";
const rajesh = "11111111-1111-4111-8111-111111111111";
const priya = "22222222-2222-4222-8222-222222222222";
const karthik = "33333333-3333-4333-8333-333333333333";
const divya = "44444444-4444-4444-8444-444444444444";
const anitha = "55555555-5555-4555-8555-555555555555";
const portalUser = "66666666-6666-4666-8666-666666666666";

const accounts = {
  murugan: "b0000000-0000-4000-8000-000000000001",
  lakshmi: "b0000000-0000-4000-8000-000000000002",
  cauvery: "b0000000-0000-4000-8000-000000000003",
  bluebay: "b0000000-0000-4000-8000-000000000004",
  arun: "b0000000-0000-4000-8000-000000000005",
  pondy: "b0000000-0000-4000-8000-000000000006",
};

const stages = {
  new: "c0000000-0000-4000-8000-000000000001",
  qualified: "c0000000-0000-4000-8000-000000000002",
  proposal: "c0000000-0000-4000-8000-000000000003",
  negotiation: "c0000000-0000-4000-8000-000000000004",
  won: "c0000000-0000-4000-8000-000000000005",
  lost: "c0000000-0000-4000-8000-000000000006",
};

function q(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

function money(paise: number): string {
  return paiseToRupees(paise).toFixed(2);
}

const muruganTax = splitGst(rupeesToPaise(75000), "33", "33");
const blueTax = splitGst(rupeesToPaise(20000), "33", "29");
const lakshmiTax = splitGst(rupeesToPaise(12000), "33", "33");

const users: Array<[string, string, string, string]> = [
  [rajesh, "rajesh.iyer@kaveri.test", "Kaveri#2026", "Rajesh Iyer"],
  [priya, "priya.subramanian@kaveri.test", "Kaveri#2026", "Priya Subramanian"],
  [karthik, "karthik.n@kaveri.test", "Kaveri#2026", "Karthik Natarajan"],
  [divya, "divya.mohan@kaveri.test", "Kaveri#2026", "Divya Mohan"],
  [anitha, "anitha.raman@kaveri.test", "Kaveri#2026", "Anitha Raman"],
  [portalUser, "murugan.textiles@client.test", "Portal#2026", "Murugan Textiles"],
];

const userInserts = users
  .map(
    ([id, email, password, name]) => `
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000', ${q(id)}, 'authenticated', 'authenticated', ${q(email)},
  extensions.crypt(${q(password)}, extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  ${q(JSON.stringify({ full_name: name }))}::jsonb,
  now(), now(), '', '', '', ''
);
insert into auth.identities (user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (
  ${q(id)}, ${q(id)},
  jsonb_build_object('sub', ${q(id)}, 'email', ${q(email)}, 'email_verified', true),
  'email', now(), now(), now()
);`,
  )
  .join("\n");

const clients: Array<{ id: string; spec: ComplianceClient; staff: string }> = [
  {
    id: accounts.murugan,
    staff: karthik,
    spec: { entityType: "pvt_ltd", gstin: "33AABCM2187Q1Z3", gstFilingFrequency: "monthly", stateCode: "33", requiresAudit: true },
  },
  {
    id: accounts.lakshmi,
    staff: divya,
    spec: { entityType: "proprietorship", gstin: "33AELPL4412D1ZY", gstFilingFrequency: "quarterly", stateCode: "33", requiresAudit: false },
  },
  {
    id: accounts.cauvery,
    staff: priya,
    spec: { entityType: "llp", gstin: "33AABFC3301H1Z8", gstFilingFrequency: "monthly", stateCode: "33", requiresAudit: true },
  },
  {
    id: accounts.bluebay,
    staff: karthik,
    spec: { entityType: "pvt_ltd", gstin: "29AADCB6621P1Z8", gstFilingFrequency: "monthly", stateCode: "29", requiresAudit: true },
  },
  {
    id: accounts.arun,
    staff: divya,
    spec: { entityType: "individual", gstin: null, gstFilingFrequency: null, stateCode: "33", requiresAudit: false },
  },
  {
    id: accounts.pondy,
    staff: divya,
    spec: { entityType: "proprietorship", gstin: "34BQPPP1188L1Z6", gstFilingFrequency: "quarterly", stateCode: "34", requiresAudit: false },
  },
];

let filingIndex = 0;
const filingRows: string[] = [];
for (const client of clients) {
  for (const filing of generateFilings(SYSTEM_RULES, client.spec, 2026)) {
    filingIndex += 1;
    let status = "pending";
    let filedAt = "null";
    let ack = "null";
    if (filing.dueDate < "2026-10-01") {
      if (filingIndex % 9 !== 0) {
        status = "filed";
        filedAt = q(`${filing.dueDate}T06:30:00+00:00`);
        ack = q(`ACK${filing.dueDate.replaceAll("-", "")}${filingIndex}`);
      }
    } else if (filing.dueDate <= "2026-11-22") {
      status = filingIndex % 2 === 0 ? "in_progress" : "pending";
    }
    filingRows.push(
      `(${q(firm)}, ${q(client.id)}, ${q(filing.ruleCode)}, ${q(filing.name)}, ${q(filing.periodKey)}, ${q(filing.periodLabel)}, 2026, ${q(filing.periodStart)}, ${q(filing.periodEnd)}, ${q(filing.dueDate)}, ${q(status)}, ${filedAt}, ${ack}, ${q(client.staff)})`,
    );
  }
}

const sql = `-- Demo firm: Kaveri & Co., a fictional Chennai practice. Not a real firm.
-- Staff password: Kaveri#2026
-- Client portal: murugan.textiles@client.test / Portal#2026

${userInserts}

insert into public.firms (
  id, name, city, state_code, address, pincode, phone, email, gstin, pan, sac_code,
  plan, subscription_status, trial_ends_at
) values (
  ${q(firm)}, 'Kaveri & Co., Chartered Accountants', 'Chennai', '33',
  '14, Luz Church Road, Mylapore', '600004', '9840011122', 'desk@kaveri.test',
  '33AAFFK4821M1ZA', 'AAFFK4821M', '998222',
  'growth', 'trialing', now() + interval '10 days'
);

insert into public.profiles (id, firm_id, full_name, email, phone, role) values
  (${q(rajesh)}, ${q(firm)}, 'Rajesh Iyer', 'rajesh.iyer@kaveri.test', '9840011122', 'owner'),
  (${q(priya)}, ${q(firm)}, 'Priya Subramanian', 'priya.subramanian@kaveri.test', '9840022233', 'partner'),
  (${q(karthik)}, ${q(firm)}, 'Karthik Natarajan', 'karthik.n@kaveri.test', '9840033344', 'staff'),
  (${q(divya)}, ${q(firm)}, 'Divya Mohan', 'divya.mohan@kaveri.test', '9840044455', 'staff'),
  (${q(anitha)}, ${q(firm)}, 'Anitha Raman', 'anitha.raman@kaveri.test', '9840055566', 'readonly');

insert into public.pipeline_stages (id, firm_id, name, position, probability, is_won, is_lost, color) values
  (${q(stages.new)}, ${q(firm)}, 'New', 1, 10, false, false, '#c4b49a'),
  (${q(stages.qualified)}, ${q(firm)}, 'Qualified', 2, 30, false, false, '#7d9a8a'),
  (${q(stages.proposal)}, ${q(firm)}, 'Proposal', 3, 50, false, false, '#c4924a'),
  (${q(stages.negotiation)}, ${q(firm)}, 'Negotiation', 4, 70, false, false, '#3d7a86'),
  (${q(stages.won)}, ${q(firm)}, 'Won', 5, 100, true, false, '#1c6b5a'),
  (${q(stages.lost)}, ${q(firm)}, 'Lost', 6, 0, false, true, '#9b3a2f');

insert into public.accounts (
  id, firm_id, name, entity_type, pan, gstin, gst_filing_frequency, state_code, place_of_supply,
  requires_audit, email, phone, address, city, pincode, assigned_staff_id, portal_enabled, status,
  consent_data_processing, consent_marketing, consent_purpose, consent_at, notes
) values
  (${q(accounts.murugan)}, ${q(firm)}, 'Murugan Textiles Pvt Ltd', 'pvt_ltd', 'AABCM2187Q', '33AABCM2187Q1Z3', 'monthly', '33', '33', true,
    'accounts@murugan-textiles.example', '9841012345', '88, Angappa Naicken Street, George Town', 'Chennai', '600001', ${q(karthik)}, true, 'active',
    true, false, 'GST returns, audit, and statutory filings', now(), 'Monthly GST plus statutory audit. Promoter prefers Tamil calls.'),
  (${q(accounts.lakshmi)}, ${q(firm)}, 'Lakshmi Sweets', 'proprietorship', 'AELPL4412D', '33AELPL4412D1ZY', 'quarterly', '33', '33', false,
    'lakshmi.sweets@example.com', '9842098765', '12, DB Road', 'Coimbatore', '641001', ${q(divya)}, false, 'active',
    true, true, 'GST retainer and income-tax return', now(), 'QRMP. Two outlets, one GSTIN.'),
  (${q(accounts.cauvery)}, ${q(firm)}, 'Cauvery Agro LLP', 'llp', 'AABFC3301H', '33AABFC3301H1Z8', 'monthly', '33', '33', true,
    'finance@cauveryagro.example', '9843011223', 'Plot 6, SIDCO Estate', 'Tiruchirappalli', '620015', ${q(priya)}, false, 'active',
    true, false, 'GST, LLP filings, and tax audit', now(), 'Paddy and cold storage. Books close by the 7th.'),
  (${q(accounts.bluebay)}, ${q(firm)}, 'Blue Bay Exports Pvt Ltd', 'pvt_ltd', 'AADCB6621P', '29AADCB6621P1Z8', 'monthly', '29', '29', true,
    'cfo@bluebayexports.example', '9844088776', '42, Industrial Suburb', 'Bengaluru', '560022', ${q(karthik)}, false, 'active',
    true, false, 'GST with LUT and transfer pricing support', now(), 'Place of supply is Karnataka, so invoices carry IGST.'),
  (${q(accounts.arun)}, ${q(firm)}, 'Arun Prakash', 'individual', 'AOPPP2291K', null, null, '33', '33', false,
    'arun.prakash@example.com', '9845077665', '7, Kutchery Road, Mylapore', 'Chennai', '600004', ${q(divya)}, false, 'active',
    true, false, 'Personal income-tax return', now(), 'Salary plus rental income. No GST registration.'),
  (${q(accounts.pondy)}, ${q(firm)}, 'Pondy Crafts', 'proprietorship', 'BQPPP1188L', '34BQPPP1188L1Z6', 'quarterly', '34', '34', false,
    'hello@pondycrafts.example', '9846066554', '18, Mission Street', 'Puducherry', '605001', ${q(divya)}, false, 'active',
    true, true, 'Quarterly GST and shop accounts', now(), 'Handloom retailer. QRMP, due date follows the 22nd group.');

insert into public.contacts (
  id, firm_id, account_id, first_name, last_name, email, phone, designation, is_primary,
  consent_data_processing, consent_purpose, consent_at
) values
  ('b1000000-0000-4000-8000-000000000001', ${q(firm)}, ${q(accounts.murugan)}, 'Selvam', 'Murugan', 'selvam@murugan-textiles.example', '9841012345', 'Managing director', true, true, 'Filings and notices', now()),
  ('b1000000-0000-4000-8000-000000000002', ${q(firm)}, ${q(accounts.lakshmi)}, 'Lakshmi', 'Narayan', 'lakshmi.sweets@example.com', '9842098765', 'Proprietor', true, true, 'GST and income tax', now()),
  ('b1000000-0000-4000-8000-000000000003', ${q(firm)}, ${q(accounts.cauvery)}, 'Ravi', 'Chandran', 'ravi@cauveryagro.example', '9843011223', 'Designated partner', true, true, 'LLP and GST', now()),
  ('b1000000-0000-4000-8000-000000000004', ${q(firm)}, ${q(accounts.bluebay)}, 'Farhan', 'Qureshi', 'farhan@bluebayexports.example', '9844088776', 'CFO', true, true, 'GST and audit', now()),
  ('b1000000-0000-4000-8000-000000000005', ${q(firm)}, ${q(accounts.arun)}, 'Arun', 'Prakash', 'arun.prakash@example.com', '9845077665', 'Self', true, true, 'Income-tax return', now()),
  ('b1000000-0000-4000-8000-000000000006', ${q(firm)}, ${q(accounts.pondy)}, 'Devika', 'Ramesh', 'hello@pondycrafts.example', '9846066554', 'Proprietor', true, true, 'Shop GST', now());

insert into public.client_users (id, firm_id, account_id, contact_id)
values (${q(portalUser)}, ${q(firm)}, ${q(accounts.murugan)}, 'b1000000-0000-4000-8000-000000000001');

insert into public.web_forms (id, firm_id, name, public_key, default_owner_id, default_source)
values ('e0000000-0000-4000-8000-000000000001', ${q(firm)}, 'Website enquiry', 'kaveriwebform01', ${q(karthik)}, 'web-form');

insert into public.leads (
  id, firm_id, first_name, last_name, company, email, phone, source, status, owner_id, city, notes,
  consent_data_processing, consent_purpose, consent_at, web_form_id, custom_fields
) values
  ('d3000000-0000-4000-8000-000000000001', ${q(firm)}, 'Meena', 'Krishnan', 'Meena Boutique', 'meena.boutique@example.com', '9841112233', 'walk-in', 'new', ${q(karthik)}, 'T. Nagar', 'Asked about monthly GST for a new boutique. Walked in with a rent agreement.', true, 'Enquiry follow-up', now(), null, '{"preferred_language":"Tamil"}'),
  ('d3000000-0000-4000-8000-000000000002', ${q(firm)}, 'Siva', 'Raman', 'Siva Constructions', 'siva.constructions@example.com', '9841223344', 'referral', 'contacted', ${q(priya)}, 'Tambaram', 'Referred by Selvam Murugan. Two sites, one proprietorship.', true, 'Enquiry follow-up', now(), null, '{}'),
  ('d3000000-0000-4000-8000-000000000003', ${q(firm)}, 'Hannah', 'George', 'Coastal Spices', 'hello@coastalspices.example', '9841334455', 'web-form', 'new', ${q(karthik)}, 'Tuticorin', 'Submitted the website form. Exports pepper and chilli.', true, 'Website enquiry', now(), 'e0000000-0000-4000-8000-000000000001', '{"preferred_language":"English"}'),
  ('d3000000-0000-4000-8000-000000000004', ${q(firm)}, 'Iqbal', 'Ahmed', 'Thanjavur Brass', 'iqbal@thanjavurbrass.example', '9841445566', 'whatsapp', 'qualified', ${q(divya)}, 'Thanjavur', 'Wants a quarterly GST retainer before the wedding season.', true, 'Enquiry follow-up', now(), null, '{}'),
  ('d3000000-0000-4000-8000-000000000005', ${q(firm)}, 'Nandini', 'Rao', 'Nilgiri Tea House', 'nandini@nilgiritea.example', '9841556677', 'phone', 'unqualified', ${q(anitha)}, 'Ooty', 'Looking for a full-time accountant on payroll, not a firm retainer.', false, null, null, null, '{}'),
  ('d3000000-0000-4000-8000-000000000006', ${q(firm)}, 'Joseph', 'D', 'Palani Tours', 'joseph@palanitours.example', '9841667788', 'referral', 'contacted', ${q(karthik)}, 'Palani', 'Fleet of two tempo travellers. Books are in a notebook.', true, 'Enquiry follow-up', now(), null, '{}');

insert into public.deals (id, firm_id, name, account_id, contact_id, stage_id, amount, expected_close, owner_id, source, notes) values
  ('d2000000-0000-4000-8000-000000000001', ${q(firm)}, 'Statutory audit FY 2026-27', ${q(accounts.murugan)}, 'b1000000-0000-4000-8000-000000000001', ${q(stages.proposal)}, 180000, '2026-12-15', ${q(karthik)}, 'existing', 'Proposal sent 12 Nov. Waiting on the board.'),
  ('d2000000-0000-4000-8000-000000000002', ${q(firm)}, 'GST retainer renewal', ${q(accounts.lakshmi)}, 'b1000000-0000-4000-8000-000000000002', ${q(stages.negotiation)}, 48000, '2026-11-30', ${q(divya)}, 'existing', 'She asked to drop the quarterly fee by two thousand.'),
  ('d2000000-0000-4000-8000-000000000003', ${q(firm)}, 'LLP filings plus GST', ${q(accounts.cauvery)}, 'b1000000-0000-4000-8000-000000000003', ${q(stages.qualified)}, 96000, '2027-01-20', ${q(priya)}, 'existing', 'Qualified. Partners want a single engagement letter.'),
  ('d2000000-0000-4000-8000-000000000004', ${q(firm)}, 'Monthly GST and LUT', ${q(accounts.bluebay)}, 'b1000000-0000-4000-8000-000000000004', ${q(stages.won)}, 120000, '2026-08-01', ${q(karthik)}, 'referral', 'Won in August. Invoiced monthly.'),
  ('d2000000-0000-4000-8000-000000000005', ${q(firm)}, 'ITR FY 2026-27', ${q(accounts.arun)}, 'b1000000-0000-4000-8000-000000000005', ${q(stages.new)}, 8000, '2027-06-30', ${q(divya)}, 'existing', 'Form 16 expected in June.'),
  ('d2000000-0000-4000-8000-000000000006', ${q(firm)}, 'GST registration', ${q(accounts.pondy)}, 'b1000000-0000-4000-8000-000000000006', ${q(stages.lost)}, 15000, '2026-06-01', ${q(divya)}, 'walk-in', 'She registered herself. Lost on price.');

insert into public.activities (firm_id, type, subject, body, due_at, completed_at, related_type, related_id, owner_id) values
  (${q(firm)}, 'task', 'Call Meena about the boutique GSTIN', 'She will bring the rental agreement and PAN.', '2026-11-18 10:00:00+05:30', null, 'lead', 'd3000000-0000-4000-8000-000000000001', ${q(karthik)}),
  (${q(firm)}, 'meeting', 'GST review with Selvam Murugan', 'October GSTR-3B and the e-invoice mismatch.', '2026-11-25 16:00:00+05:30', null, 'account', ${q(accounts.murugan)}, ${q(karthik)}),
  (${q(firm)}, 'task', 'Chase Lakshmi Sweets bank statement', 'Need September and October for the QRMP working.', '2026-11-20 11:00:00+05:30', null, 'account', ${q(accounts.lakshmi)}, ${q(divya)}),
  (${q(firm)}, 'note', 'LUT acknowledgement filed', 'Blue Bay LUT for FY 2026-27 is on the portal. ARN saved in the vault.', null, null, 'account', ${q(accounts.bluebay)}, ${q(karthik)}),
  (${q(firm)}, 'call', 'Introductory call with Coastal Spices', 'Hannah wants a quote for monthly GST plus LUT.', '2026-11-23 15:30:00+05:30', null, 'lead', 'd3000000-0000-4000-8000-000000000003', ${q(karthik)}),
  (${q(firm)}, 'task', 'Send engagement letter to Cauvery Agro', 'Priya to review the LLP scope before it goes out.', '2026-11-28 12:00:00+05:30', null, 'deal', 'd2000000-0000-4000-8000-000000000003', ${q(priya)});

insert into public.tags (id, firm_id, name, color) values
  ('e1000000-0000-4000-8000-000000000001', ${q(firm)}, 'GST', '#1c6b5a'),
  ('e1000000-0000-4000-8000-000000000002', ${q(firm)}, 'Audit', '#9a7040'),
  ('e1000000-0000-4000-8000-000000000003', ${q(firm)}, 'Retainer', '#3d7a86');

insert into public.record_tags (firm_id, tag_id, record_type, record_id) values
  (${q(firm)}, 'e1000000-0000-4000-8000-000000000001', 'account', ${q(accounts.murugan)}),
  (${q(firm)}, 'e1000000-0000-4000-8000-000000000002', 'account', ${q(accounts.murugan)}),
  (${q(firm)}, 'e1000000-0000-4000-8000-000000000003', 'account', ${q(accounts.lakshmi)}),
  (${q(firm)}, 'e1000000-0000-4000-8000-000000000001', 'deal', 'd2000000-0000-4000-8000-000000000004');

insert into public.custom_field_defs (firm_id, module, key, label, field_type, options, position) values
  (${q(firm)}, 'lead', 'preferred_language', 'Preferred language', 'select', '["Tamil","English"]'::jsonb, 1);

insert into public.saved_views (firm_id, user_id, module, name, filters, is_shared) values
  (${q(firm)}, ${q(rajesh)}, 'lead', 'New leads', '{"status":"new"}'::jsonb, true),
  (${q(firm)}, ${q(divya)}, 'account', 'My clients', ${`'{"staff":"${divya}"}'`}::jsonb, false);

insert into public.engagements (id, firm_id, account_id, service_name, sac_code, fee, billing_cycle, start_date, status) values
  ('e2000000-0000-4000-8000-000000000001', ${q(firm)}, ${q(accounts.murugan)}, 'Statutory audit', '998221', 75000, 'annual', '2026-04-01', 'active'),
  ('e2000000-0000-4000-8000-000000000002', ${q(firm)}, ${q(accounts.bluebay)}, 'Monthly GST and LUT', '998231', 20000, 'monthly', '2026-08-01', 'active'),
  ('e2000000-0000-4000-8000-000000000003', ${q(firm)}, ${q(accounts.lakshmi)}, 'Bookkeeping and QRMP', '998222', 12000, 'quarterly', '2026-04-01', 'active');

insert into public.invoices (
  id, firm_id, account_id, engagement_id, invoice_number, invoice_date, due_date, place_of_supply,
  sac_code, description, taxable_value, cgst, sgst, igst, total, status
) values
  ('e3000000-0000-4000-8000-000000000001', ${q(firm)}, ${q(accounts.murugan)}, 'e2000000-0000-4000-8000-000000000001',
    'KA/26-27/001', '2026-10-02', '2026-10-17', '33', '998221', 'Statutory audit, first instalment',
    ${money(muruganTax.taxablePaise)}, ${money(muruganTax.cgstPaise)}, ${money(muruganTax.sgstPaise)}, ${money(muruganTax.igstPaise)}, ${money(muruganTax.totalPaise)}, 'paid'),
  ('e3000000-0000-4000-8000-000000000002', ${q(firm)}, ${q(accounts.bluebay)}, 'e2000000-0000-4000-8000-000000000002',
    'KA/26-27/014', '2026-11-03', '2026-11-18', '29', '998231', 'GST compliance for October 2026',
    ${money(blueTax.taxablePaise)}, ${money(blueTax.cgstPaise)}, ${money(blueTax.sgstPaise)}, ${money(blueTax.igstPaise)}, ${money(blueTax.totalPaise)}, 'sent'),
  ('e3000000-0000-4000-8000-000000000003', ${q(firm)}, ${q(accounts.lakshmi)}, 'e2000000-0000-4000-8000-000000000003',
    'KA/26-27/011', '2026-10-08', '2026-10-23', '33', '998222', 'Bookkeeping and QRMP, Q2',
    ${money(lakshmiTax.taxablePaise)}, ${money(lakshmiTax.cgstPaise)}, ${money(lakshmiTax.sgstPaise)}, ${money(lakshmiTax.igstPaise)}, ${money(lakshmiTax.totalPaise)}, 'partial');

insert into public.invoice_payments (firm_id, invoice_id, amount, paid_on, mode, reference) values
  (${q(firm)}, 'e3000000-0000-4000-8000-000000000001', ${money(muruganTax.totalPaise)}, '2026-10-09', 'neft', 'NEFT MURUGAN 09OCT'),
  (${q(firm)}, 'e3000000-0000-4000-8000-000000000003', 5000, '2026-10-20', 'upi', 'UPI LAKSHMI 20OCT');

insert into public.time_entries (firm_id, user_id, account_id, engagement_id, work_date, minutes, description, billable) values
  (${q(firm)}, ${q(karthik)}, ${q(accounts.murugan)}, 'e2000000-0000-4000-8000-000000000001', '2026-11-12', 180, 'Vouching October purchase register', true),
  (${q(firm)}, ${q(karthik)}, ${q(accounts.bluebay)}, 'e2000000-0000-4000-8000-000000000002', '2026-11-14', 90, 'GSTR-1 working and e-invoice reconciliation', true),
  (${q(firm)}, ${q(divya)}, ${q(accounts.lakshmi)}, 'e2000000-0000-4000-8000-000000000003', '2026-11-18', 120, 'QRMP books for July to September', true),
  (${q(firm)}, ${q(priya)}, ${q(accounts.cauvery)}, null, '2026-11-19', 60, 'Scope call for the LLP engagement', false);

insert into public.documents (firm_id, account_id, financial_year, folder, name, storage_path, mime, size_bytes, uploaded_by, client_visible) values
  (${q(firm)}, ${q(accounts.murugan)}, '2026-27', 'Engagement', 'Engagement letter FY 2026-27.txt',
    ${q(firm + "/" + accounts.murugan + "/2026-27/engagement-letter.txt")}, 'text/plain', 420, ${q(rajesh)}, true);

insert into public.document_requests (firm_id, account_id, title, financial_year, folder, status, upload_token, notes) values
  (${q(firm)}, ${q(accounts.murugan)}, 'October 2026 bank statement', '2026-27', 'Bank', 'requested', 'murugan-bank-oct-2026', 'HDFC current account, PDF is enough.'),
  (${q(firm)}, ${q(accounts.lakshmi)}, 'Q2 purchase bills', '2026-27', 'GST', 'requested', 'lakshmi-q2-bills', 'Zip of July to September purchases.');

insert into public.workflow_rules (firm_id, name, trigger_event, actions, active) values
  (${q(firm)}, 'New lead: assign Karthik and open a call task', 'lead.created',
    jsonb_build_array(
      jsonb_build_object('type', 'assign_owner', 'userId', ${q(karthik)}),
      jsonb_build_object('type', 'create_task', 'subject', 'Call new lead within a day', 'dueInDays', 1, 'ownerId', ${q(karthik)})
    ), true),
  (${q(firm)}, 'Deal moved: tell the owner', 'deal.stage_changed',
    jsonb_build_array(
      jsonb_build_object('type', 'notify', 'userId', ${q(rajesh)}, 'title', 'Deal stage changed', 'body', '{{deal_name}} is now in {{stage_name}}')
    ), true);

insert into public.message_templates (firm_id, channel, name, subject, body) values
  (${q(firm)}, 'whatsapp', 'Filing reminder', null,
    'Hello {{name}}, this is Kaveri & Co. {{filing}} for {{period}} is due on {{due_date}}. Please send the working papers if you have not already. — {{firm_name}}'),
  (${q(firm)}, 'email', 'Invoice', 'Invoice {{invoice_number}} from {{firm_name}}',
    'Dear {{name}},\\n\\nInvoice {{invoice_number}} for {{amount}} is attached. It is due on {{due_date}}.\\n\\nKaveri & Co., Chartered Accountants');

insert into public.notifications (firm_id, user_id, title, body, link) values
  (${q(firm)}, ${q(rajesh)}, 'Three filings are overdue', 'Murugan Textiles and Lakshmi Sweets have returns past the due date.', '/compliance'),
  (${q(firm)}, ${q(divya)}, 'Lakshmi Sweets fee is partly unpaid', 'KA/26-27/011 has a balance after the UPI of Rs 5,000.', '/invoices');

insert into public.compliance_filings (
  firm_id, account_id, rule_code, name, period_key, period_label, fy_start_year,
  period_start, period_end, due_date, status, filed_at, acknowledgement_no, assigned_to
) values
${filingRows.join(",\n")};
`;

writeFileSync(new URL("../supabase/seed.sql", import.meta.url), sql);
console.log(`seed filings: ${filingRows.length}`);
