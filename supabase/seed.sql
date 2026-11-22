-- Demo firm: Kaveri & Co., a fictional Chennai practice. Not a real firm.
-- Staff password: Kaveri#2026
-- Client portal: murugan.textiles@client.test / Portal#2026


insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'rajesh.iyer@kaveri.test',
  extensions.crypt('Kaveri#2026', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Rajesh Iyer"}'::jsonb,
  now(), now(), '', '', '', ''
);
insert into auth.identities (user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (
  '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111',
  jsonb_build_object('sub', '11111111-1111-4111-8111-111111111111', 'email', 'rajesh.iyer@kaveri.test', 'email_verified', true),
  'email', now(), now(), now()
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'priya.subramanian@kaveri.test',
  extensions.crypt('Kaveri#2026', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Priya Subramanian"}'::jsonb,
  now(), now(), '', '', '', ''
);
insert into auth.identities (user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (
  '22222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222',
  jsonb_build_object('sub', '22222222-2222-4222-8222-222222222222', 'email', 'priya.subramanian@kaveri.test', 'email_verified', true),
  'email', now(), now(), now()
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'karthik.n@kaveri.test',
  extensions.crypt('Kaveri#2026', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Karthik Natarajan"}'::jsonb,
  now(), now(), '', '', '', ''
);
insert into auth.identities (user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (
  '33333333-3333-4333-8333-333333333333', '33333333-3333-4333-8333-333333333333',
  jsonb_build_object('sub', '33333333-3333-4333-8333-333333333333', 'email', 'karthik.n@kaveri.test', 'email_verified', true),
  'email', now(), now(), now()
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000', '44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', 'divya.mohan@kaveri.test',
  extensions.crypt('Kaveri#2026', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Divya Mohan"}'::jsonb,
  now(), now(), '', '', '', ''
);
insert into auth.identities (user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (
  '44444444-4444-4444-8444-444444444444', '44444444-4444-4444-8444-444444444444',
  jsonb_build_object('sub', '44444444-4444-4444-8444-444444444444', 'email', 'divya.mohan@kaveri.test', 'email_verified', true),
  'email', now(), now(), now()
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000', '55555555-5555-4555-8555-555555555555', 'authenticated', 'authenticated', 'anitha.raman@kaveri.test',
  extensions.crypt('Kaveri#2026', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Anitha Raman"}'::jsonb,
  now(), now(), '', '', '', ''
);
insert into auth.identities (user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (
  '55555555-5555-4555-8555-555555555555', '55555555-5555-4555-8555-555555555555',
  jsonb_build_object('sub', '55555555-5555-4555-8555-555555555555', 'email', 'anitha.raman@kaveri.test', 'email_verified', true),
  'email', now(), now(), now()
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000', '66666666-6666-4666-8666-666666666666', 'authenticated', 'authenticated', 'murugan.textiles@client.test',
  extensions.crypt('Portal#2026', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Murugan Textiles"}'::jsonb,
  now(), now(), '', '', '', ''
);
insert into auth.identities (user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (
  '66666666-6666-4666-8666-666666666666', '66666666-6666-4666-8666-666666666666',
  jsonb_build_object('sub', '66666666-6666-4666-8666-666666666666', 'email', 'murugan.textiles@client.test', 'email_verified', true),
  'email', now(), now(), now()
);

insert into public.firms (
  id, name, city, state_code, address, pincode, phone, email, gstin, pan, sac_code,
  plan, subscription_status, trial_ends_at
) values (
  'a0000000-0000-4000-8000-000000000001', 'Kaveri & Co., Chartered Accountants', 'Chennai', '33',
  '14, Luz Church Road, Mylapore', '600004', '9840011122', 'desk@kaveri.test',
  '33AAFFK4821M1ZA', 'AAFFK4821M', '998222',
  'growth', 'trialing', now() + interval '10 days'
);

insert into public.profiles (id, firm_id, full_name, email, phone, role) values
  ('11111111-1111-4111-8111-111111111111', 'a0000000-0000-4000-8000-000000000001', 'Rajesh Iyer', 'rajesh.iyer@kaveri.test', '9840011122', 'owner'),
  ('22222222-2222-4222-8222-222222222222', 'a0000000-0000-4000-8000-000000000001', 'Priya Subramanian', 'priya.subramanian@kaveri.test', '9840022233', 'partner'),
  ('33333333-3333-4333-8333-333333333333', 'a0000000-0000-4000-8000-000000000001', 'Karthik Natarajan', 'karthik.n@kaveri.test', '9840033344', 'staff'),
  ('44444444-4444-4444-8444-444444444444', 'a0000000-0000-4000-8000-000000000001', 'Divya Mohan', 'divya.mohan@kaveri.test', '9840044455', 'staff'),
  ('55555555-5555-4555-8555-555555555555', 'a0000000-0000-4000-8000-000000000001', 'Anitha Raman', 'anitha.raman@kaveri.test', '9840055566', 'readonly');

insert into public.pipeline_stages (id, firm_id, name, position, probability, is_won, is_lost, color) values
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'New', 1, 10, false, false, '#c4b49a'),
  ('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Qualified', 2, 30, false, false, '#7d9a8a'),
  ('c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'Proposal', 3, 50, false, false, '#c4924a'),
  ('c0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'Negotiation', 4, 70, false, false, '#3d7a86'),
  ('c0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'Won', 5, 100, true, false, '#1c6b5a'),
  ('c0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001', 'Lost', 6, 0, false, true, '#9b3a2f');

insert into public.accounts (
  id, firm_id, name, entity_type, pan, gstin, gst_filing_frequency, state_code, place_of_supply,
  requires_audit, email, phone, address, city, pincode, assigned_staff_id, portal_enabled, status,
  consent_data_processing, consent_marketing, consent_purpose, consent_at, notes
) values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Murugan Textiles Pvt Ltd', 'pvt_ltd', 'AABCM2187Q', '33AABCM2187Q1Z3', 'monthly', '33', '33', true,
    'accounts@murugan-textiles.example', '9841012345', '88, Angappa Naicken Street, George Town', 'Chennai', '600001', '33333333-3333-4333-8333-333333333333', true, 'active',
    true, false, 'GST returns, audit, and statutory filings', now(), 'Monthly GST plus statutory audit. Promoter prefers Tamil calls.'),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Lakshmi Sweets', 'proprietorship', 'AELPL4412D', '33AELPL4412D1ZY', 'quarterly', '33', '33', false,
    'lakshmi.sweets@example.com', '9842098765', '12, DB Road', 'Coimbatore', '641001', '44444444-4444-4444-8444-444444444444', false, 'active',
    true, true, 'GST retainer and income-tax return', now(), 'QRMP. Two outlets, one GSTIN.'),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'Cauvery Agro LLP', 'llp', 'AABFC3301H', '33AABFC3301H1Z8', 'monthly', '33', '33', true,
    'finance@cauveryagro.example', '9843011223', 'Plot 6, SIDCO Estate', 'Tiruchirappalli', '620015', '22222222-2222-4222-8222-222222222222', false, 'active',
    true, false, 'GST, LLP filings, and tax audit', now(), 'Paddy and cold storage. Books close by the 7th.'),
  ('b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'Blue Bay Exports Pvt Ltd', 'pvt_ltd', 'AADCB6621P', '29AADCB6621P1Z8', 'monthly', '29', '29', true,
    'cfo@bluebayexports.example', '9844088776', '42, Industrial Suburb', 'Bengaluru', '560022', '33333333-3333-4333-8333-333333333333', false, 'active',
    true, false, 'GST with LUT and transfer pricing support', now(), 'Place of supply is Karnataka, so invoices carry IGST.'),
  ('b0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'Arun Prakash', 'individual', 'AOPPP2291K', null, null, '33', '33', false,
    'arun.prakash@example.com', '9845077665', '7, Kutchery Road, Mylapore', 'Chennai', '600004', '44444444-4444-4444-8444-444444444444', false, 'active',
    true, false, 'Personal income-tax return', now(), 'Salary plus rental income. No GST registration.'),
  ('b0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001', 'Pondy Crafts', 'proprietorship', 'BQPPP1188L', '34BQPPP1188L1Z6', 'quarterly', '34', '34', false,
    'hello@pondycrafts.example', '9846066554', '18, Mission Street', 'Puducherry', '605001', '44444444-4444-4444-8444-444444444444', false, 'active',
    true, true, 'Quarterly GST and shop accounts', now(), 'Handloom retailer. QRMP, due date follows the 22nd group.');

insert into public.contacts (
  id, firm_id, account_id, first_name, last_name, email, phone, designation, is_primary,
  consent_data_processing, consent_purpose, consent_at
) values
  ('b1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Selvam', 'Murugan', 'selvam@murugan-textiles.example', '9841012345', 'Managing director', true, true, 'Filings and notices', now()),
  ('b1000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'Lakshmi', 'Narayan', 'lakshmi.sweets@example.com', '9842098765', 'Proprietor', true, true, 'GST and income tax', now()),
  ('b1000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'Ravi', 'Chandran', 'ravi@cauveryagro.example', '9843011223', 'Designated partner', true, true, 'LLP and GST', now()),
  ('b1000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'Farhan', 'Qureshi', 'farhan@bluebayexports.example', '9844088776', 'CFO', true, true, 'GST and audit', now()),
  ('b1000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000005', 'Arun', 'Prakash', 'arun.prakash@example.com', '9845077665', 'Self', true, true, 'Income-tax return', now()),
  ('b1000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000006', 'Devika', 'Ramesh', 'hello@pondycrafts.example', '9846066554', 'Proprietor', true, true, 'Shop GST', now());

insert into public.client_users (id, firm_id, account_id, contact_id)
values ('66666666-6666-4666-8666-666666666666', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001');

insert into public.web_forms (id, firm_id, name, public_key, default_owner_id, default_source)
values ('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Website enquiry', 'kaveriwebform01', '33333333-3333-4333-8333-333333333333', 'web-form');

insert into public.leads (
  id, firm_id, first_name, last_name, company, email, phone, source, status, owner_id, city, notes,
  consent_data_processing, consent_purpose, consent_at, web_form_id, custom_fields
) values
  ('d3000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Meena', 'Krishnan', 'Meena Boutique', 'meena.boutique@example.com', '9841112233', 'walk-in', 'new', '33333333-3333-4333-8333-333333333333', 'T. Nagar', 'Asked about monthly GST for a new boutique. Walked in with a rent agreement.', true, 'Enquiry follow-up', now(), null, '{"preferred_language":"Tamil"}'),
  ('d3000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Siva', 'Raman', 'Siva Constructions', 'siva.constructions@example.com', '9841223344', 'referral', 'contacted', '22222222-2222-4222-8222-222222222222', 'Tambaram', 'Referred by Selvam Murugan. Two sites, one proprietorship.', true, 'Enquiry follow-up', now(), null, '{}'),
  ('d3000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'Hannah', 'George', 'Coastal Spices', 'hello@coastalspices.example', '9841334455', 'web-form', 'new', '33333333-3333-4333-8333-333333333333', 'Tuticorin', 'Submitted the website form. Exports pepper and chilli.', true, 'Website enquiry', now(), 'e0000000-0000-4000-8000-000000000001', '{"preferred_language":"English"}'),
  ('d3000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'Iqbal', 'Ahmed', 'Thanjavur Brass', 'iqbal@thanjavurbrass.example', '9841445566', 'whatsapp', 'qualified', '44444444-4444-4444-8444-444444444444', 'Thanjavur', 'Wants a quarterly GST retainer before the wedding season.', true, 'Enquiry follow-up', now(), null, '{}'),
  ('d3000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'Nandini', 'Rao', 'Nilgiri Tea House', 'nandini@nilgiritea.example', '9841556677', 'phone', 'unqualified', '55555555-5555-4555-8555-555555555555', 'Ooty', 'Looking for a full-time accountant on payroll, not a firm retainer.', false, null, null, null, '{}'),
  ('d3000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001', 'Joseph', 'D', 'Palani Tours', 'joseph@palanitours.example', '9841667788', 'referral', 'contacted', '33333333-3333-4333-8333-333333333333', 'Palani', 'Fleet of two tempo travellers. Books are in a notebook.', true, 'Enquiry follow-up', now(), null, '{}');

insert into public.deals (id, firm_id, name, account_id, contact_id, stage_id, amount, expected_close, owner_id, source, notes) values
  ('d2000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Statutory audit FY 2026-27', 'b0000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003', 180000, '2026-12-15', '33333333-3333-4333-8333-333333333333', 'existing', 'Proposal sent 12 Nov. Waiting on the board.'),
  ('d2000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'GST retainer renewal', 'b0000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000004', 48000, '2026-11-30', '44444444-4444-4444-8444-444444444444', 'existing', 'She asked to drop the quarterly fee by two thousand.'),
  ('d2000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'LLP filings plus GST', 'b0000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000002', 96000, '2027-01-20', '22222222-2222-4222-8222-222222222222', 'existing', 'Qualified. Partners want a single engagement letter.'),
  ('d2000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'Monthly GST and LUT', 'b0000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000005', 120000, '2026-08-01', '33333333-3333-4333-8333-333333333333', 'referral', 'Won in August. Invoiced monthly.'),
  ('d2000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'ITR FY 2026-27', 'b0000000-0000-4000-8000-000000000005', 'b1000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000001', 8000, '2027-06-30', '44444444-4444-4444-8444-444444444444', 'existing', 'Form 16 expected in June.'),
  ('d2000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001', 'GST registration', 'b0000000-0000-4000-8000-000000000006', 'b1000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000006', 15000, '2026-06-01', '44444444-4444-4444-8444-444444444444', 'walk-in', 'She registered herself. Lost on price.');

insert into public.activities (firm_id, type, subject, body, due_at, completed_at, related_type, related_id, owner_id) values
  ('a0000000-0000-4000-8000-000000000001', 'task', 'Call Meena about the boutique GSTIN', 'She will bring the rental agreement and PAN.', '2026-11-18 10:00:00+05:30', null, 'lead', 'd3000000-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333'),
  ('a0000000-0000-4000-8000-000000000001', 'meeting', 'GST review with Selvam Murugan', 'October GSTR-3B and the e-invoice mismatch.', '2026-11-25 16:00:00+05:30', null, 'account', 'b0000000-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333'),
  ('a0000000-0000-4000-8000-000000000001', 'task', 'Chase Lakshmi Sweets bank statement', 'Need September and October for the QRMP working.', '2026-11-20 11:00:00+05:30', null, 'account', 'b0000000-0000-4000-8000-000000000002', '44444444-4444-4444-8444-444444444444'),
  ('a0000000-0000-4000-8000-000000000001', 'note', 'LUT acknowledgement filed', 'Blue Bay LUT for FY 2026-27 is on the portal. ARN saved in the vault.', null, null, 'account', 'b0000000-0000-4000-8000-000000000004', '33333333-3333-4333-8333-333333333333'),
  ('a0000000-0000-4000-8000-000000000001', 'call', 'Introductory call with Coastal Spices', 'Hannah wants a quote for monthly GST plus LUT.', '2026-11-23 15:30:00+05:30', null, 'lead', 'd3000000-0000-4000-8000-000000000003', '33333333-3333-4333-8333-333333333333'),
  ('a0000000-0000-4000-8000-000000000001', 'task', 'Send engagement letter to Cauvery Agro', 'Priya to review the LLP scope before it goes out.', '2026-11-28 12:00:00+05:30', null, 'deal', 'd2000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222');

insert into public.tags (id, firm_id, name, color) values
  ('e1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'GST', '#1c6b5a'),
  ('e1000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Audit', '#9a7040'),
  ('e1000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'Retainer', '#3d7a86');

insert into public.record_tags (firm_id, tag_id, record_type, record_id) values
  ('a0000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 'account', 'b0000000-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000002', 'account', 'b0000000-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000003', 'account', 'b0000000-0000-4000-8000-000000000002'),
  ('a0000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 'deal', 'd2000000-0000-4000-8000-000000000004');

insert into public.custom_field_defs (firm_id, module, key, label, field_type, options, position) values
  ('a0000000-0000-4000-8000-000000000001', 'lead', 'preferred_language', 'Preferred language', 'select', '["Tamil","English"]'::jsonb, 1);

insert into public.saved_views (firm_id, user_id, module, name, filters, is_shared) values
  ('a0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'lead', 'New leads', '{"status":"new"}'::jsonb, true),
  ('a0000000-0000-4000-8000-000000000001', '44444444-4444-4444-8444-444444444444', 'account', 'My clients', '{"staff":"44444444-4444-4444-8444-444444444444"}'::jsonb, false);

insert into public.engagements (id, firm_id, account_id, service_name, sac_code, fee, billing_cycle, start_date, status) values
  ('e2000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Statutory audit', '998221', 75000, 'annual', '2026-04-01', 'active'),
  ('e2000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'Monthly GST and LUT', '998231', 20000, 'monthly', '2026-08-01', 'active'),
  ('e2000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'Bookkeeping and QRMP', '998222', 12000, 'quarterly', '2026-04-01', 'active');

insert into public.invoices (
  id, firm_id, account_id, engagement_id, invoice_number, invoice_date, due_date, place_of_supply,
  sac_code, description, taxable_value, cgst, sgst, igst, total, status
) values
  ('e3000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000001',
    'KA/26-27/001', '2026-10-02', '2026-10-17', '33', '998221', 'Statutory audit, first instalment',
    75000.00, 6750.00, 6750.00, 0.00, 88500.00, 'paid'),
  ('e3000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'e2000000-0000-4000-8000-000000000002',
    'KA/26-27/014', '2026-11-03', '2026-11-18', '29', '998231', 'GST compliance for October 2026',
    20000.00, 0.00, 0.00, 3600.00, 23600.00, 'sent'),
  ('e3000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'e2000000-0000-4000-8000-000000000003',
    'KA/26-27/011', '2026-10-08', '2026-10-23', '33', '998222', 'Bookkeeping and QRMP, Q2',
    12000.00, 1080.00, 1080.00, 0.00, 14160.00, 'partial');

insert into public.invoice_payments (firm_id, invoice_id, amount, paid_on, mode, reference) values
  ('a0000000-0000-4000-8000-000000000001', 'e3000000-0000-4000-8000-000000000001', 88500.00, '2026-10-09', 'neft', 'NEFT MURUGAN 09OCT'),
  ('a0000000-0000-4000-8000-000000000001', 'e3000000-0000-4000-8000-000000000003', 5000, '2026-10-20', 'upi', 'UPI LAKSHMI 20OCT');

insert into public.time_entries (firm_id, user_id, account_id, engagement_id, work_date, minutes, description, billable) values
  ('a0000000-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333', 'b0000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000001', '2026-11-12', 180, 'Vouching October purchase register', true),
  ('a0000000-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333', 'b0000000-0000-4000-8000-000000000004', 'e2000000-0000-4000-8000-000000000002', '2026-11-14', 90, 'GSTR-1 working and e-invoice reconciliation', true),
  ('a0000000-0000-4000-8000-000000000001', '44444444-4444-4444-8444-444444444444', 'b0000000-0000-4000-8000-000000000002', 'e2000000-0000-4000-8000-000000000003', '2026-11-18', 120, 'QRMP books for July to September', true),
  ('a0000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'b0000000-0000-4000-8000-000000000003', null, '2026-11-19', 60, 'Scope call for the LLP engagement', false);

insert into public.documents (firm_id, account_id, financial_year, folder, name, storage_path, mime, size_bytes, uploaded_by, client_visible) values
  ('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', '2026-27', 'Engagement', 'Engagement letter FY 2026-27.txt',
    'a0000000-0000-4000-8000-000000000001/b0000000-0000-4000-8000-000000000001/2026-27/engagement-letter.txt', 'text/plain', 420, '11111111-1111-4111-8111-111111111111', true);

insert into public.document_requests (firm_id, account_id, title, financial_year, folder, status, upload_token, notes) values
  ('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'October 2026 bank statement', '2026-27', 'Bank', 'requested', 'murugan-bank-oct-2026', 'HDFC current account, PDF is enough.'),
  ('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'Q2 purchase bills', '2026-27', 'GST', 'requested', 'lakshmi-q2-bills', 'Zip of July to September purchases.');

insert into public.workflow_rules (firm_id, name, trigger_event, actions, active) values
  ('a0000000-0000-4000-8000-000000000001', 'New lead: assign Karthik and open a call task', 'lead.created',
    jsonb_build_array(
      jsonb_build_object('type', 'assign_owner', 'userId', '33333333-3333-4333-8333-333333333333'),
      jsonb_build_object('type', 'create_task', 'subject', 'Call new lead within a day', 'dueInDays', 1, 'ownerId', '33333333-3333-4333-8333-333333333333')
    ), true),
  ('a0000000-0000-4000-8000-000000000001', 'Deal moved: tell the owner', 'deal.stage_changed',
    jsonb_build_array(
      jsonb_build_object('type', 'notify', 'userId', '11111111-1111-4111-8111-111111111111', 'title', 'Deal stage changed', 'body', '{{deal_name}} is now in {{stage_name}}')
    ), true);

insert into public.message_templates (firm_id, channel, name, subject, body) values
  ('a0000000-0000-4000-8000-000000000001', 'whatsapp', 'Filing reminder', null,
    'Hello {{name}}, this is Kaveri & Co. {{filing}} for {{period}} is due on {{due_date}}. Please send the working papers if you have not already. — {{firm_name}}'),
  ('a0000000-0000-4000-8000-000000000001', 'email', 'Invoice', 'Invoice {{invoice_number}} from {{firm_name}}',
    'Dear {{name}},\n\nInvoice {{invoice_number}} for {{amount}} is attached. It is due on {{due_date}}.\n\nKaveri & Co., Chartered Accountants');

insert into public.notifications (firm_id, user_id, title, body, link) values
  ('a0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Three filings are overdue', 'Murugan Textiles and Lakshmi Sweets have returns past the due date.', '/compliance'),
  ('a0000000-0000-4000-8000-000000000001', '44444444-4444-4444-8444-444444444444', 'Lakshmi Sweets fee is partly unpaid', 'KA/26-27/011 has a balance after the UPI of Rs 5,000.', '/invoices');

insert into public.compliance_filings (
  firm_id, account_id, rule_code, name, period_key, period_label, fy_start_year,
  period_start, period_end, due_date, status, filed_at, acknowledgement_no, assigned_to
) values
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'GSTR1', 'GSTR-1', 'M04', 'Apr 2026', 2026, '2026-04-01', '2026-04-30', '2026-05-11', 'filed', '2026-05-11T06:30:00+00:00', 'ACK202605111', '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'GSTR3B', 'GSTR-3B', 'M04', 'Apr 2026', 2026, '2026-04-01', '2026-04-30', '2026-05-20', 'filed', '2026-05-20T06:30:00+00:00', 'ACK202605202', '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'GSTR1', 'GSTR-1', 'M05', 'May 2026', 2026, '2026-05-01', '2026-05-31', '2026-06-11', 'filed', '2026-06-11T06:30:00+00:00', 'ACK202606113', '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'ADV_TAX', 'Advance tax', 'ADV1', '15 Jun 2026 · 15%', 2026, '2026-04-01', '2026-06-30', '2026-06-15', 'filed', '2026-06-15T06:30:00+00:00', 'ACK202606154', '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'GSTR3B', 'GSTR-3B', 'M05', 'May 2026', 2026, '2026-05-01', '2026-05-31', '2026-06-20', 'filed', '2026-06-20T06:30:00+00:00', 'ACK202606205', '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'GSTR1', 'GSTR-1', 'M06', 'Jun 2026', 2026, '2026-06-01', '2026-06-30', '2026-07-11', 'filed', '2026-07-11T06:30:00+00:00', 'ACK202607116', '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'GSTR3B', 'GSTR-3B', 'M06', 'Jun 2026', 2026, '2026-06-01', '2026-06-30', '2026-07-20', 'filed', '2026-07-20T06:30:00+00:00', 'ACK202607207', '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'TDS', 'TDS return (24Q/26Q)', 'Q1', 'Q1 2026-27 (Apr–Jun)', 2026, '2026-04-01', '2026-06-30', '2026-07-31', 'filed', '2026-07-31T06:30:00+00:00', 'ACK202607318', '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'GSTR1', 'GSTR-1', 'M07', 'Jul 2026', 2026, '2026-07-01', '2026-07-31', '2026-08-11', 'pending', null, null, '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'GSTR3B', 'GSTR-3B', 'M07', 'Jul 2026', 2026, '2026-07-01', '2026-07-31', '2026-08-20', 'filed', '2026-08-20T06:30:00+00:00', 'ACK2026082010', '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'GSTR1', 'GSTR-1', 'M08', 'Aug 2026', 2026, '2026-08-01', '2026-08-31', '2026-09-11', 'filed', '2026-09-11T06:30:00+00:00', 'ACK2026091111', '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'ADV_TAX', 'Advance tax', 'ADV2', '15 Sep 2026 · 45%', 2026, '2026-07-01', '2026-09-30', '2026-09-15', 'filed', '2026-09-15T06:30:00+00:00', 'ACK2026091512', '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'GSTR3B', 'GSTR-3B', 'M08', 'Aug 2026', 2026, '2026-08-01', '2026-08-31', '2026-09-20', 'filed', '2026-09-20T06:30:00+00:00', 'ACK2026092013', '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'GSTR1', 'GSTR-1', 'M09', 'Sep 2026', 2026, '2026-09-01', '2026-09-30', '2026-10-11', 'in_progress', null, null, '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'GSTR3B', 'GSTR-3B', 'M09', 'Sep 2026', 2026, '2026-09-01', '2026-09-30', '2026-10-20', 'pending', null, null, '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'TDS', 'TDS return (24Q/26Q)', 'Q2', 'Q2 2026-27 (Jul–Sep)', 2026, '2026-07-01', '2026-09-30', '2026-10-31', 'in_progress', null, null, '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'GSTR1', 'GSTR-1', 'M10', 'Oct 2026', 2026, '2026-10-01', '2026-10-31', '2026-11-11', 'pending', null, null, '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'GSTR3B', 'GSTR-3B', 'M10', 'Oct 2026', 2026, '2026-10-01', '2026-10-31', '2026-11-20', 'in_progress', null, null, '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'GSTR1', 'GSTR-1', 'M11', 'Nov 2026', 2026, '2026-11-01', '2026-11-30', '2026-12-11', 'pending', null, null, '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'ADV_TAX', 'Advance tax', 'ADV3', '15 Dec 2026 · 75%', 2026, '2026-10-01', '2026-12-31', '2026-12-15', 'pending', null, null, '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'GSTR3B', 'GSTR-3B', 'M11', 'Nov 2026', 2026, '2026-11-01', '2026-11-30', '2026-12-20', 'pending', null, null, '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'GSTR1', 'GSTR-1', 'M12', 'Dec 2026', 2026, '2026-12-01', '2026-12-31', '2027-01-11', 'pending', null, null, '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'GSTR3B', 'GSTR-3B', 'M12', 'Dec 2026', 2026, '2026-12-01', '2026-12-31', '2027-01-20', 'pending', null, null, '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'TDS', 'TDS return (24Q/26Q)', 'Q3', 'Q3 2026-27 (Oct–Dec)', 2026, '2026-10-01', '2026-12-31', '2027-01-31', 'pending', null, null, '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'GSTR1', 'GSTR-1', 'M01', 'Jan 2027', 2026, '2027-01-01', '2027-01-31', '2027-02-11', 'pending', null, null, '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'GSTR3B', 'GSTR-3B', 'M01', 'Jan 2027', 2026, '2027-01-01', '2027-01-31', '2027-02-20', 'pending', null, null, '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'GSTR1', 'GSTR-1', 'M02', 'Feb 2027', 2026, '2027-02-01', '2027-02-28', '2027-03-11', 'pending', null, null, '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'ADV_TAX', 'Advance tax', 'ADV4', '15 Mar 2027 · 100%', 2026, '2027-01-01', '2027-03-31', '2027-03-15', 'pending', null, null, '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'GSTR3B', 'GSTR-3B', 'M02', 'Feb 2027', 2026, '2027-02-01', '2027-02-28', '2027-03-20', 'pending', null, null, '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'GSTR1', 'GSTR-1', 'M03', 'Mar 2027', 2026, '2027-03-01', '2027-03-31', '2027-04-11', 'pending', null, null, '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'GSTR3B', 'GSTR-3B', 'M03', 'Mar 2027', 2026, '2027-03-01', '2027-03-31', '2027-04-20', 'pending', null, null, '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'TDS', 'TDS return (24Q/26Q)', 'Q4', 'Q4 2026-27 (Jan–Mar)', 2026, '2027-01-01', '2027-03-31', '2027-05-31', 'pending', null, null, '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'MCA_AOC4', 'AOC-4', 'FY', 'AOC-4 2026-27', 2026, '2026-04-01', '2027-03-31', '2027-10-30', 'pending', null, null, '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'ITR', 'Income-tax return (audit)', 'FY', 'ITR (audit) 2026-27', 2026, '2026-04-01', '2027-03-31', '2027-10-31', 'pending', null, null, '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'MCA_MGT7', 'MGT-7', 'FY', 'MGT-7 2026-27', 2026, '2026-04-01', '2027-03-31', '2027-11-29', 'pending', null, null, '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'ADV_TAX', 'Advance tax', 'ADV1', '15 Jun 2026 · 15%', 2026, '2026-04-01', '2026-06-30', '2026-06-15', 'pending', null, null, '44444444-4444-4444-8444-444444444444'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'GSTR1', 'GSTR-1 (QRMP)', 'Q1', 'Q1 2026-27 (Apr–Jun)', 2026, '2026-04-01', '2026-06-30', '2026-07-13', 'filed', '2026-07-13T06:30:00+00:00', 'ACK2026071337', '44444444-4444-4444-8444-444444444444'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'GSTR3B', 'GSTR-3B (QRMP)', 'Q1', 'Q1 2026-27 (Apr–Jun)', 2026, '2026-04-01', '2026-06-30', '2026-07-22', 'filed', '2026-07-22T06:30:00+00:00', 'ACK2026072238', '44444444-4444-4444-8444-444444444444'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'TDS', 'TDS return (24Q/26Q)', 'Q1', 'Q1 2026-27 (Apr–Jun)', 2026, '2026-04-01', '2026-06-30', '2026-07-31', 'filed', '2026-07-31T06:30:00+00:00', 'ACK2026073139', '44444444-4444-4444-8444-444444444444'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'ADV_TAX', 'Advance tax', 'ADV2', '15 Sep 2026 · 45%', 2026, '2026-07-01', '2026-09-30', '2026-09-15', 'filed', '2026-09-15T06:30:00+00:00', 'ACK2026091540', '44444444-4444-4444-8444-444444444444'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'GSTR1', 'GSTR-1 (QRMP)', 'Q2', 'Q2 2026-27 (Jul–Sep)', 2026, '2026-07-01', '2026-09-30', '2026-10-13', 'pending', null, null, '44444444-4444-4444-8444-444444444444'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'GSTR3B', 'GSTR-3B (QRMP)', 'Q2', 'Q2 2026-27 (Jul–Sep)', 2026, '2026-07-01', '2026-09-30', '2026-10-22', 'in_progress', null, null, '44444444-4444-4444-8444-444444444444'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'TDS', 'TDS return (24Q/26Q)', 'Q2', 'Q2 2026-27 (Jul–Sep)', 2026, '2026-07-01', '2026-09-30', '2026-10-31', 'pending', null, null, '44444444-4444-4444-8444-444444444444'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'ADV_TAX', 'Advance tax', 'ADV3', '15 Dec 2026 · 75%', 2026, '2026-10-01', '2026-12-31', '2026-12-15', 'pending', null, null, '44444444-4444-4444-8444-444444444444'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'GSTR1', 'GSTR-1 (QRMP)', 'Q3', 'Q3 2026-27 (Oct–Dec)', 2026, '2026-10-01', '2026-12-31', '2027-01-13', 'pending', null, null, '44444444-4444-4444-8444-444444444444'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'GSTR3B', 'GSTR-3B (QRMP)', 'Q3', 'Q3 2026-27 (Oct–Dec)', 2026, '2026-10-01', '2026-12-31', '2027-01-22', 'pending', null, null, '44444444-4444-4444-8444-444444444444'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'TDS', 'TDS return (24Q/26Q)', 'Q3', 'Q3 2026-27 (Oct–Dec)', 2026, '2026-10-01', '2026-12-31', '2027-01-31', 'pending', null, null, '44444444-4444-4444-8444-444444444444'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'ADV_TAX', 'Advance tax', 'ADV4', '15 Mar 2027 · 100%', 2026, '2027-01-01', '2027-03-31', '2027-03-15', 'pending', null, null, '44444444-4444-4444-8444-444444444444'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'GSTR1', 'GSTR-1 (QRMP)', 'Q4', 'Q4 2026-27 (Jan–Mar)', 2026, '2027-01-01', '2027-03-31', '2027-04-13', 'pending', null, null, '44444444-4444-4444-8444-444444444444'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'GSTR3B', 'GSTR-3B (QRMP)', 'Q4', 'Q4 2026-27 (Jan–Mar)', 2026, '2027-01-01', '2027-03-31', '2027-04-22', 'pending', null, null, '44444444-4444-4444-8444-444444444444'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'TDS', 'TDS return (24Q/26Q)', 'Q4', 'Q4 2026-27 (Jan–Mar)', 2026, '2027-01-01', '2027-03-31', '2027-05-31', 'pending', null, null, '44444444-4444-4444-8444-444444444444'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'ITR', 'Income-tax return', 'FY', 'ITR 2026-27', 2026, '2026-04-01', '2027-03-31', '2027-07-31', 'pending', null, null, '44444444-4444-4444-8444-444444444444'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'GSTR1', 'GSTR-1', 'M04', 'Apr 2026', 2026, '2026-04-01', '2026-04-30', '2026-05-11', 'filed', '2026-05-11T06:30:00+00:00', 'ACK2026051153', '22222222-2222-4222-8222-222222222222'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'GSTR3B', 'GSTR-3B', 'M04', 'Apr 2026', 2026, '2026-04-01', '2026-04-30', '2026-05-20', 'pending', null, null, '22222222-2222-4222-8222-222222222222'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'GSTR1', 'GSTR-1', 'M05', 'May 2026', 2026, '2026-05-01', '2026-05-31', '2026-06-11', 'filed', '2026-06-11T06:30:00+00:00', 'ACK2026061155', '22222222-2222-4222-8222-222222222222'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'ADV_TAX', 'Advance tax', 'ADV1', '15 Jun 2026 · 15%', 2026, '2026-04-01', '2026-06-30', '2026-06-15', 'filed', '2026-06-15T06:30:00+00:00', 'ACK2026061556', '22222222-2222-4222-8222-222222222222'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'GSTR3B', 'GSTR-3B', 'M05', 'May 2026', 2026, '2026-05-01', '2026-05-31', '2026-06-20', 'filed', '2026-06-20T06:30:00+00:00', 'ACK2026062057', '22222222-2222-4222-8222-222222222222'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'GSTR1', 'GSTR-1', 'M06', 'Jun 2026', 2026, '2026-06-01', '2026-06-30', '2026-07-11', 'filed', '2026-07-11T06:30:00+00:00', 'ACK2026071158', '22222222-2222-4222-8222-222222222222'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'GSTR3B', 'GSTR-3B', 'M06', 'Jun 2026', 2026, '2026-06-01', '2026-06-30', '2026-07-20', 'filed', '2026-07-20T06:30:00+00:00', 'ACK2026072059', '22222222-2222-4222-8222-222222222222'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'TDS', 'TDS return (24Q/26Q)', 'Q1', 'Q1 2026-27 (Apr–Jun)', 2026, '2026-04-01', '2026-06-30', '2026-07-31', 'filed', '2026-07-31T06:30:00+00:00', 'ACK2026073160', '22222222-2222-4222-8222-222222222222'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'GSTR1', 'GSTR-1', 'M07', 'Jul 2026', 2026, '2026-07-01', '2026-07-31', '2026-08-11', 'filed', '2026-08-11T06:30:00+00:00', 'ACK2026081161', '22222222-2222-4222-8222-222222222222'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'GSTR3B', 'GSTR-3B', 'M07', 'Jul 2026', 2026, '2026-07-01', '2026-07-31', '2026-08-20', 'filed', '2026-08-20T06:30:00+00:00', 'ACK2026082062', '22222222-2222-4222-8222-222222222222'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'GSTR1', 'GSTR-1', 'M08', 'Aug 2026', 2026, '2026-08-01', '2026-08-31', '2026-09-11', 'pending', null, null, '22222222-2222-4222-8222-222222222222'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'ADV_TAX', 'Advance tax', 'ADV2', '15 Sep 2026 · 45%', 2026, '2026-07-01', '2026-09-30', '2026-09-15', 'filed', '2026-09-15T06:30:00+00:00', 'ACK2026091564', '22222222-2222-4222-8222-222222222222'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'GSTR3B', 'GSTR-3B', 'M08', 'Aug 2026', 2026, '2026-08-01', '2026-08-31', '2026-09-20', 'filed', '2026-09-20T06:30:00+00:00', 'ACK2026092065', '22222222-2222-4222-8222-222222222222'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'GSTR1', 'GSTR-1', 'M09', 'Sep 2026', 2026, '2026-09-01', '2026-09-30', '2026-10-11', 'in_progress', null, null, '22222222-2222-4222-8222-222222222222'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'GSTR3B', 'GSTR-3B', 'M09', 'Sep 2026', 2026, '2026-09-01', '2026-09-30', '2026-10-20', 'pending', null, null, '22222222-2222-4222-8222-222222222222'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'TDS', 'TDS return (24Q/26Q)', 'Q2', 'Q2 2026-27 (Jul–Sep)', 2026, '2026-07-01', '2026-09-30', '2026-10-31', 'in_progress', null, null, '22222222-2222-4222-8222-222222222222'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'GSTR1', 'GSTR-1', 'M10', 'Oct 2026', 2026, '2026-10-01', '2026-10-31', '2026-11-11', 'pending', null, null, '22222222-2222-4222-8222-222222222222'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'GSTR3B', 'GSTR-3B', 'M10', 'Oct 2026', 2026, '2026-10-01', '2026-10-31', '2026-11-20', 'in_progress', null, null, '22222222-2222-4222-8222-222222222222'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'GSTR1', 'GSTR-1', 'M11', 'Nov 2026', 2026, '2026-11-01', '2026-11-30', '2026-12-11', 'pending', null, null, '22222222-2222-4222-8222-222222222222'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'ADV_TAX', 'Advance tax', 'ADV3', '15 Dec 2026 · 75%', 2026, '2026-10-01', '2026-12-31', '2026-12-15', 'pending', null, null, '22222222-2222-4222-8222-222222222222'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'GSTR3B', 'GSTR-3B', 'M11', 'Nov 2026', 2026, '2026-11-01', '2026-11-30', '2026-12-20', 'pending', null, null, '22222222-2222-4222-8222-222222222222'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'GSTR1', 'GSTR-1', 'M12', 'Dec 2026', 2026, '2026-12-01', '2026-12-31', '2027-01-11', 'pending', null, null, '22222222-2222-4222-8222-222222222222'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'GSTR3B', 'GSTR-3B', 'M12', 'Dec 2026', 2026, '2026-12-01', '2026-12-31', '2027-01-20', 'pending', null, null, '22222222-2222-4222-8222-222222222222'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'TDS', 'TDS return (24Q/26Q)', 'Q3', 'Q3 2026-27 (Oct–Dec)', 2026, '2026-10-01', '2026-12-31', '2027-01-31', 'pending', null, null, '22222222-2222-4222-8222-222222222222'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'GSTR1', 'GSTR-1', 'M01', 'Jan 2027', 2026, '2027-01-01', '2027-01-31', '2027-02-11', 'pending', null, null, '22222222-2222-4222-8222-222222222222'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'GSTR3B', 'GSTR-3B', 'M01', 'Jan 2027', 2026, '2027-01-01', '2027-01-31', '2027-02-20', 'pending', null, null, '22222222-2222-4222-8222-222222222222'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'GSTR1', 'GSTR-1', 'M02', 'Feb 2027', 2026, '2027-02-01', '2027-02-28', '2027-03-11', 'pending', null, null, '22222222-2222-4222-8222-222222222222'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'ADV_TAX', 'Advance tax', 'ADV4', '15 Mar 2027 · 100%', 2026, '2027-01-01', '2027-03-31', '2027-03-15', 'pending', null, null, '22222222-2222-4222-8222-222222222222'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'GSTR3B', 'GSTR-3B', 'M02', 'Feb 2027', 2026, '2027-02-01', '2027-02-28', '2027-03-20', 'pending', null, null, '22222222-2222-4222-8222-222222222222'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'GSTR1', 'GSTR-1', 'M03', 'Mar 2027', 2026, '2027-03-01', '2027-03-31', '2027-04-11', 'pending', null, null, '22222222-2222-4222-8222-222222222222'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'GSTR3B', 'GSTR-3B', 'M03', 'Mar 2027', 2026, '2027-03-01', '2027-03-31', '2027-04-20', 'pending', null, null, '22222222-2222-4222-8222-222222222222'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'LLP_11', 'LLP Form 11', 'FY', 'LLP Form 11 2026-27', 2026, '2026-04-01', '2027-03-31', '2027-05-30', 'pending', null, null, '22222222-2222-4222-8222-222222222222'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'TDS', 'TDS return (24Q/26Q)', 'Q4', 'Q4 2026-27 (Jan–Mar)', 2026, '2027-01-01', '2027-03-31', '2027-05-31', 'pending', null, null, '22222222-2222-4222-8222-222222222222'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'LLP_8', 'LLP Form 8', 'FY', 'LLP Form 8 2026-27', 2026, '2026-04-01', '2027-03-31', '2027-10-30', 'pending', null, null, '22222222-2222-4222-8222-222222222222'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'ITR', 'Income-tax return (audit)', 'FY', 'ITR (audit) 2026-27', 2026, '2026-04-01', '2027-03-31', '2027-10-31', 'pending', null, null, '22222222-2222-4222-8222-222222222222'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'GSTR1', 'GSTR-1', 'M04', 'Apr 2026', 2026, '2026-04-01', '2026-04-30', '2026-05-11', 'filed', '2026-05-11T06:30:00+00:00', 'ACK2026051188', '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'GSTR3B', 'GSTR-3B', 'M04', 'Apr 2026', 2026, '2026-04-01', '2026-04-30', '2026-05-20', 'filed', '2026-05-20T06:30:00+00:00', 'ACK2026052089', '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'GSTR1', 'GSTR-1', 'M05', 'May 2026', 2026, '2026-05-01', '2026-05-31', '2026-06-11', 'pending', null, null, '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'ADV_TAX', 'Advance tax', 'ADV1', '15 Jun 2026 · 15%', 2026, '2026-04-01', '2026-06-30', '2026-06-15', 'filed', '2026-06-15T06:30:00+00:00', 'ACK2026061591', '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'GSTR3B', 'GSTR-3B', 'M05', 'May 2026', 2026, '2026-05-01', '2026-05-31', '2026-06-20', 'filed', '2026-06-20T06:30:00+00:00', 'ACK2026062092', '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'GSTR1', 'GSTR-1', 'M06', 'Jun 2026', 2026, '2026-06-01', '2026-06-30', '2026-07-11', 'filed', '2026-07-11T06:30:00+00:00', 'ACK2026071193', '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'GSTR3B', 'GSTR-3B', 'M06', 'Jun 2026', 2026, '2026-06-01', '2026-06-30', '2026-07-20', 'filed', '2026-07-20T06:30:00+00:00', 'ACK2026072094', '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'TDS', 'TDS return (24Q/26Q)', 'Q1', 'Q1 2026-27 (Apr–Jun)', 2026, '2026-04-01', '2026-06-30', '2026-07-31', 'filed', '2026-07-31T06:30:00+00:00', 'ACK2026073195', '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'GSTR1', 'GSTR-1', 'M07', 'Jul 2026', 2026, '2026-07-01', '2026-07-31', '2026-08-11', 'filed', '2026-08-11T06:30:00+00:00', 'ACK2026081196', '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'GSTR3B', 'GSTR-3B', 'M07', 'Jul 2026', 2026, '2026-07-01', '2026-07-31', '2026-08-20', 'filed', '2026-08-20T06:30:00+00:00', 'ACK2026082097', '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'GSTR1', 'GSTR-1', 'M08', 'Aug 2026', 2026, '2026-08-01', '2026-08-31', '2026-09-11', 'filed', '2026-09-11T06:30:00+00:00', 'ACK2026091198', '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'ADV_TAX', 'Advance tax', 'ADV2', '15 Sep 2026 · 45%', 2026, '2026-07-01', '2026-09-30', '2026-09-15', 'pending', null, null, '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'GSTR3B', 'GSTR-3B', 'M08', 'Aug 2026', 2026, '2026-08-01', '2026-08-31', '2026-09-20', 'filed', '2026-09-20T06:30:00+00:00', 'ACK20260920100', '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'GSTR1', 'GSTR-1', 'M09', 'Sep 2026', 2026, '2026-09-01', '2026-09-30', '2026-10-11', 'pending', null, null, '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'GSTR3B', 'GSTR-3B', 'M09', 'Sep 2026', 2026, '2026-09-01', '2026-09-30', '2026-10-20', 'in_progress', null, null, '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'TDS', 'TDS return (24Q/26Q)', 'Q2', 'Q2 2026-27 (Jul–Sep)', 2026, '2026-07-01', '2026-09-30', '2026-10-31', 'pending', null, null, '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'GSTR1', 'GSTR-1', 'M10', 'Oct 2026', 2026, '2026-10-01', '2026-10-31', '2026-11-11', 'in_progress', null, null, '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'GSTR3B', 'GSTR-3B', 'M10', 'Oct 2026', 2026, '2026-10-01', '2026-10-31', '2026-11-20', 'pending', null, null, '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'GSTR1', 'GSTR-1', 'M11', 'Nov 2026', 2026, '2026-11-01', '2026-11-30', '2026-12-11', 'pending', null, null, '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'ADV_TAX', 'Advance tax', 'ADV3', '15 Dec 2026 · 75%', 2026, '2026-10-01', '2026-12-31', '2026-12-15', 'pending', null, null, '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'GSTR3B', 'GSTR-3B', 'M11', 'Nov 2026', 2026, '2026-11-01', '2026-11-30', '2026-12-20', 'pending', null, null, '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'GSTR1', 'GSTR-1', 'M12', 'Dec 2026', 2026, '2026-12-01', '2026-12-31', '2027-01-11', 'pending', null, null, '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'GSTR3B', 'GSTR-3B', 'M12', 'Dec 2026', 2026, '2026-12-01', '2026-12-31', '2027-01-20', 'pending', null, null, '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'TDS', 'TDS return (24Q/26Q)', 'Q3', 'Q3 2026-27 (Oct–Dec)', 2026, '2026-10-01', '2026-12-31', '2027-01-31', 'pending', null, null, '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'GSTR1', 'GSTR-1', 'M01', 'Jan 2027', 2026, '2027-01-01', '2027-01-31', '2027-02-11', 'pending', null, null, '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'GSTR3B', 'GSTR-3B', 'M01', 'Jan 2027', 2026, '2027-01-01', '2027-01-31', '2027-02-20', 'pending', null, null, '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'GSTR1', 'GSTR-1', 'M02', 'Feb 2027', 2026, '2027-02-01', '2027-02-28', '2027-03-11', 'pending', null, null, '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'ADV_TAX', 'Advance tax', 'ADV4', '15 Mar 2027 · 100%', 2026, '2027-01-01', '2027-03-31', '2027-03-15', 'pending', null, null, '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'GSTR3B', 'GSTR-3B', 'M02', 'Feb 2027', 2026, '2027-02-01', '2027-02-28', '2027-03-20', 'pending', null, null, '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'GSTR1', 'GSTR-1', 'M03', 'Mar 2027', 2026, '2027-03-01', '2027-03-31', '2027-04-11', 'pending', null, null, '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'GSTR3B', 'GSTR-3B', 'M03', 'Mar 2027', 2026, '2027-03-01', '2027-03-31', '2027-04-20', 'pending', null, null, '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'TDS', 'TDS return (24Q/26Q)', 'Q4', 'Q4 2026-27 (Jan–Mar)', 2026, '2027-01-01', '2027-03-31', '2027-05-31', 'pending', null, null, '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'MCA_AOC4', 'AOC-4', 'FY', 'AOC-4 2026-27', 2026, '2026-04-01', '2027-03-31', '2027-10-30', 'pending', null, null, '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'ITR', 'Income-tax return (audit)', 'FY', 'ITR (audit) 2026-27', 2026, '2026-04-01', '2027-03-31', '2027-10-31', 'pending', null, null, '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'MCA_MGT7', 'MGT-7', 'FY', 'MGT-7 2026-27', 2026, '2026-04-01', '2027-03-31', '2027-11-29', 'pending', null, null, '33333333-3333-4333-8333-333333333333'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000005', 'ADV_TAX', 'Advance tax', 'ADV1', '15 Jun 2026 · 15%', 2026, '2026-04-01', '2026-06-30', '2026-06-15', 'filed', '2026-06-15T06:30:00+00:00', 'ACK20260615123', '44444444-4444-4444-8444-444444444444'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000005', 'ADV_TAX', 'Advance tax', 'ADV2', '15 Sep 2026 · 45%', 2026, '2026-07-01', '2026-09-30', '2026-09-15', 'filed', '2026-09-15T06:30:00+00:00', 'ACK20260915124', '44444444-4444-4444-8444-444444444444'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000005', 'ADV_TAX', 'Advance tax', 'ADV3', '15 Dec 2026 · 75%', 2026, '2026-10-01', '2026-12-31', '2026-12-15', 'pending', null, null, '44444444-4444-4444-8444-444444444444'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000005', 'ADV_TAX', 'Advance tax', 'ADV4', '15 Mar 2027 · 100%', 2026, '2027-01-01', '2027-03-31', '2027-03-15', 'pending', null, null, '44444444-4444-4444-8444-444444444444'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000005', 'ITR', 'Income-tax return', 'FY', 'ITR 2026-27', 2026, '2026-04-01', '2027-03-31', '2027-07-31', 'pending', null, null, '44444444-4444-4444-8444-444444444444'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000006', 'ADV_TAX', 'Advance tax', 'ADV1', '15 Jun 2026 · 15%', 2026, '2026-04-01', '2026-06-30', '2026-06-15', 'filed', '2026-06-15T06:30:00+00:00', 'ACK20260615128', '44444444-4444-4444-8444-444444444444'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000006', 'GSTR1', 'GSTR-1 (QRMP)', 'Q1', 'Q1 2026-27 (Apr–Jun)', 2026, '2026-04-01', '2026-06-30', '2026-07-13', 'filed', '2026-07-13T06:30:00+00:00', 'ACK20260713129', '44444444-4444-4444-8444-444444444444'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000006', 'GSTR3B', 'GSTR-3B (QRMP)', 'Q1', 'Q1 2026-27 (Apr–Jun)', 2026, '2026-04-01', '2026-06-30', '2026-07-22', 'filed', '2026-07-22T06:30:00+00:00', 'ACK20260722130', '44444444-4444-4444-8444-444444444444'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000006', 'TDS', 'TDS return (24Q/26Q)', 'Q1', 'Q1 2026-27 (Apr–Jun)', 2026, '2026-04-01', '2026-06-30', '2026-07-31', 'filed', '2026-07-31T06:30:00+00:00', 'ACK20260731131', '44444444-4444-4444-8444-444444444444'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000006', 'ADV_TAX', 'Advance tax', 'ADV2', '15 Sep 2026 · 45%', 2026, '2026-07-01', '2026-09-30', '2026-09-15', 'filed', '2026-09-15T06:30:00+00:00', 'ACK20260915132', '44444444-4444-4444-8444-444444444444'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000006', 'GSTR1', 'GSTR-1 (QRMP)', 'Q2', 'Q2 2026-27 (Jul–Sep)', 2026, '2026-07-01', '2026-09-30', '2026-10-13', 'pending', null, null, '44444444-4444-4444-8444-444444444444'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000006', 'GSTR3B', 'GSTR-3B (QRMP)', 'Q2', 'Q2 2026-27 (Jul–Sep)', 2026, '2026-07-01', '2026-09-30', '2026-10-22', 'in_progress', null, null, '44444444-4444-4444-8444-444444444444'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000006', 'TDS', 'TDS return (24Q/26Q)', 'Q2', 'Q2 2026-27 (Jul–Sep)', 2026, '2026-07-01', '2026-09-30', '2026-10-31', 'pending', null, null, '44444444-4444-4444-8444-444444444444'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000006', 'ADV_TAX', 'Advance tax', 'ADV3', '15 Dec 2026 · 75%', 2026, '2026-10-01', '2026-12-31', '2026-12-15', 'pending', null, null, '44444444-4444-4444-8444-444444444444'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000006', 'GSTR1', 'GSTR-1 (QRMP)', 'Q3', 'Q3 2026-27 (Oct–Dec)', 2026, '2026-10-01', '2026-12-31', '2027-01-13', 'pending', null, null, '44444444-4444-4444-8444-444444444444'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000006', 'GSTR3B', 'GSTR-3B (QRMP)', 'Q3', 'Q3 2026-27 (Oct–Dec)', 2026, '2026-10-01', '2026-12-31', '2027-01-22', 'pending', null, null, '44444444-4444-4444-8444-444444444444'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000006', 'TDS', 'TDS return (24Q/26Q)', 'Q3', 'Q3 2026-27 (Oct–Dec)', 2026, '2026-10-01', '2026-12-31', '2027-01-31', 'pending', null, null, '44444444-4444-4444-8444-444444444444'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000006', 'ADV_TAX', 'Advance tax', 'ADV4', '15 Mar 2027 · 100%', 2026, '2027-01-01', '2027-03-31', '2027-03-15', 'pending', null, null, '44444444-4444-4444-8444-444444444444'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000006', 'GSTR1', 'GSTR-1 (QRMP)', 'Q4', 'Q4 2026-27 (Jan–Mar)', 2026, '2027-01-01', '2027-03-31', '2027-04-13', 'pending', null, null, '44444444-4444-4444-8444-444444444444'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000006', 'GSTR3B', 'GSTR-3B (QRMP)', 'Q4', 'Q4 2026-27 (Jan–Mar)', 2026, '2027-01-01', '2027-03-31', '2027-04-22', 'pending', null, null, '44444444-4444-4444-8444-444444444444'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000006', 'TDS', 'TDS return (24Q/26Q)', 'Q4', 'Q4 2026-27 (Jan–Mar)', 2026, '2027-01-01', '2027-03-31', '2027-05-31', 'pending', null, null, '44444444-4444-4444-8444-444444444444'),
('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000006', 'ITR', 'Income-tax return', 'FY', 'ITR 2026-27', 2026, '2026-04-01', '2027-03-31', '2027-07-31', 'pending', null, null, '44444444-4444-4444-8444-444444444444');
