-- Unikorn360: firms, CRM, compliance calendar, billing, and audit.

-- Fresh namespace only: fail before touching anything if already present.
create schema crmpro;
revoke all on schema crmpro from public, anon;
grant usage on schema crmpro to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Tenancy
-- ---------------------------------------------------------------------------

create table crmpro.firms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  state_code text not null default '33',
  address text,
  pincode text,
  phone text,
  email text,
  gstin text,
  pan text,
  sac_code text not null default '998222',
  plan text not null default 'growth' check (plan in ('starter', 'growth', 'pro')),
  subscription_status text not null default 'trialing' check (subscription_status in ('trialing', 'active', 'past_due', 'cancelled')),
  trial_ends_at timestamptz,
  razorpay_customer_id text,
  razorpay_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint firms_gstin_format check (gstin is null or gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  constraint firms_state_code check (state_code ~ '^[0-9]{2}$')
);

create table crmpro.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  firm_id uuid not null references crmpro.firms (id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  role text not null check (role in ('owner', 'partner', 'staff', 'readonly')),
  created_at timestamptz not null default now()
);

create index profiles_firm_idx on crmpro.profiles (firm_id);

create table crmpro.accounts (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references crmpro.firms (id) on delete cascade,
  name text not null,
  entity_type text not null check (entity_type in (
    'individual', 'proprietorship', 'partnership', 'huf', 'llp', 'pvt_ltd', 'public_ltd', 'trust', 'society'
  )),
  pan text,
  gstin text,
  gst_filing_frequency text check (gst_filing_frequency in ('monthly', 'quarterly')),
  state_code text not null default '33',
  place_of_supply text not null default '33',
  requires_audit boolean not null default false,
  email text,
  phone text,
  address text,
  city text,
  pincode text,
  assigned_staff_id uuid references crmpro.profiles (id) on delete set null,
  portal_enabled boolean not null default false,
  status text not null default 'active' check (status in ('active', 'inactive')),
  consent_data_processing boolean not null default false,
  consent_marketing boolean not null default false,
  consent_purpose text,
  consent_at timestamptz,
  custom_fields jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounts_gstin_format check (gstin is null or gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  constraint accounts_state_code check (state_code ~ '^[0-9]{2}$' and place_of_supply ~ '^[0-9]{2}$')
);

create index accounts_firm_idx on crmpro.accounts (firm_id);

create table crmpro.contacts (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references crmpro.firms (id) on delete cascade,
  account_id uuid references crmpro.accounts (id) on delete set null,
  first_name text not null,
  last_name text,
  email text,
  phone text,
  designation text,
  is_primary boolean not null default false,
  consent_data_processing boolean not null default false,
  consent_marketing boolean not null default false,
  consent_purpose text,
  consent_at timestamptz,
  deleted_at timestamptz,
  custom_fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contacts_firm_idx on crmpro.contacts (firm_id);
create index contacts_account_idx on crmpro.contacts (account_id);

create table crmpro.client_users (
  id uuid primary key references auth.users (id) on delete cascade,
  firm_id uuid not null references crmpro.firms (id) on delete cascade,
  account_id uuid not null references crmpro.accounts (id) on delete cascade,
  contact_id uuid references crmpro.contacts (id) on delete set null,
  created_at timestamptz not null default now()
);

create table crmpro.invitations (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references crmpro.firms (id) on delete cascade,
  email text not null,
  role text not null check (role in ('partner', 'staff', 'readonly')),
  token text not null unique,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table crmpro.portal_invites (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references crmpro.firms (id) on delete cascade,
  account_id uuid not null references crmpro.accounts (id) on delete cascade,
  email text not null,
  token text not null unique,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- CRM
-- ---------------------------------------------------------------------------

create table crmpro.leads (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references crmpro.firms (id) on delete cascade,
  first_name text not null,
  last_name text,
  email text,
  phone text,
  company text,
  source text not null default 'manual',
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'unqualified', 'converted')),
  owner_id uuid references crmpro.profiles (id) on delete set null,
  gstin text,
  pan text,
  city text,
  notes text,
  consent_data_processing boolean not null default false,
  consent_marketing boolean not null default false,
  consent_purpose text,
  consent_at timestamptz,
  converted_account_id uuid references crmpro.accounts (id) on delete set null,
  converted_contact_id uuid references crmpro.contacts (id) on delete set null,
  web_form_id uuid,
  custom_fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_firm_status_idx on crmpro.leads (firm_id, status);
create index leads_firm_created_idx on crmpro.leads (firm_id, created_at desc);

create table crmpro.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references crmpro.firms (id) on delete cascade,
  name text not null,
  position integer not null,
  probability integer not null default 0 check (probability between 0 and 100),
  is_won boolean not null default false,
  is_lost boolean not null default false,
  color text not null default '#1c6b5a'
);

create index pipeline_stages_firm_idx on crmpro.pipeline_stages (firm_id, position);

create table crmpro.deals (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references crmpro.firms (id) on delete cascade,
  name text not null,
  account_id uuid references crmpro.accounts (id) on delete set null,
  contact_id uuid references crmpro.contacts (id) on delete set null,
  stage_id uuid not null references crmpro.pipeline_stages (id),
  amount numeric(14, 2) not null default 0 check (amount >= 0),
  expected_close date,
  owner_id uuid references crmpro.profiles (id) on delete set null,
  source text,
  notes text,
  custom_fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index deals_firm_stage_idx on crmpro.deals (firm_id, stage_id);

create table crmpro.activities (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references crmpro.firms (id) on delete cascade,
  type text not null check (type in ('task', 'call', 'meeting', 'note')),
  subject text not null,
  body text,
  due_at timestamptz,
  completed_at timestamptz,
  related_type text check (related_type in ('lead', 'contact', 'account', 'deal', 'filing', 'invoice')),
  related_id uuid,
  owner_id uuid references crmpro.profiles (id) on delete set null,
  reminder_at timestamptz,
  created_at timestamptz not null default now()
);

create index activities_firm_due_idx on crmpro.activities (firm_id, due_at);

create table crmpro.tags (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references crmpro.firms (id) on delete cascade,
  name text not null,
  color text not null default '#9a7040',
  unique (firm_id, name)
);

create table crmpro.record_tags (
  firm_id uuid not null references crmpro.firms (id) on delete cascade,
  tag_id uuid not null references crmpro.tags (id) on delete cascade,
  record_type text not null check (record_type in ('lead', 'contact', 'account', 'deal')),
  record_id uuid not null,
  primary key (tag_id, record_type, record_id)
);

create index record_tags_record_idx on crmpro.record_tags (record_type, record_id);

create table crmpro.custom_field_defs (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references crmpro.firms (id) on delete cascade,
  module text not null check (module in ('lead', 'contact', 'account', 'deal')),
  key text not null,
  label text not null,
  field_type text not null check (field_type in ('text', 'number', 'date', 'select', 'boolean')),
  options jsonb not null default '[]'::jsonb,
  required boolean not null default false,
  position integer not null default 0,
  unique (firm_id, module, key)
);

create table crmpro.saved_views (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references crmpro.firms (id) on delete cascade,
  user_id uuid references crmpro.profiles (id) on delete cascade,
  module text not null,
  name text not null,
  filters jsonb not null default '{}'::jsonb,
  is_shared boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Practice
-- ---------------------------------------------------------------------------

create table crmpro.compliance_rules (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid references crmpro.firms (id) on delete cascade,
  code text not null,
  variant text not null,
  name text not null,
  frequency text not null check (frequency in ('monthly', 'quarterly', 'annual', 'installment')),
  entity_types text[],
  gst_frequencies text[],
  requires_gstin boolean not null default false,
  audit_mode text not null default 'any' check (audit_mode in ('any', 'audit', 'non_audit')),
  state_codes text[],
  notes text,
  active boolean not null default true,
  constraint compliance_rules_identity unique nulls not distinct (firm_id, code, variant)
);

create table crmpro.compliance_rule_periods (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references crmpro.compliance_rules (id) on delete cascade,
  period_key text not null,
  label text not null,
  start_month integer not null check (start_month between 1 and 12),
  start_year_offset integer not null check (start_year_offset in (0, 1)),
  end_month integer not null check (end_month between 1 and 12),
  end_year_offset integer not null check (end_year_offset in (0, 1)),
  due_month integer not null check (due_month between 1 and 12),
  due_day integer not null check (due_day between 1 and 31),
  due_year_offset integer not null check (due_year_offset in (0, 1)),
  sort integer not null,
  unique (rule_id, period_key)
);

create table crmpro.compliance_filings (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references crmpro.firms (id) on delete cascade,
  account_id uuid not null references crmpro.accounts (id) on delete cascade,
  rule_code text not null,
  name text not null,
  period_key text not null,
  period_label text not null,
  fy_start_year integer not null,
  period_start date not null,
  period_end date not null,
  due_date date not null,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'filed')),
  filed_at timestamptz,
  acknowledgement_no text,
  assigned_to uuid references crmpro.profiles (id) on delete set null,
  notes text,
  unique (account_id, rule_code, fy_start_year, period_key)
);

create index filings_firm_due_idx on crmpro.compliance_filings (firm_id, due_date);
create index filings_account_idx on crmpro.compliance_filings (account_id);

create table crmpro.engagements (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references crmpro.firms (id) on delete cascade,
  account_id uuid not null references crmpro.accounts (id) on delete cascade,
  service_name text not null,
  sac_code text not null default '998222',
  fee numeric(14, 2) not null default 0 check (fee >= 0),
  billing_cycle text not null default 'annual' check (billing_cycle in ('one_time', 'monthly', 'quarterly', 'annual')),
  start_date date,
  status text not null default 'active' check (status in ('active', 'paused', 'closed')),
  notes text,
  created_at timestamptz not null default now()
);

create table crmpro.invoices (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references crmpro.firms (id) on delete cascade,
  account_id uuid not null references crmpro.accounts (id) on delete restrict,
  engagement_id uuid references crmpro.engagements (id) on delete set null,
  invoice_number text not null,
  invoice_date date not null,
  due_date date,
  place_of_supply text not null,
  sac_code text not null,
  description text not null,
  taxable_value numeric(14, 2) not null check (taxable_value >= 0),
  cgst numeric(14, 2) not null default 0 check (cgst >= 0),
  sgst numeric(14, 2) not null default 0 check (sgst >= 0),
  igst numeric(14, 2) not null default 0 check (igst >= 0),
  total numeric(14, 2) not null check (total >= 0),
  status text not null default 'sent' check (status in ('draft', 'sent', 'partial', 'paid', 'void')),
  notes text,
  created_at timestamptz not null default now(),
  unique (firm_id, invoice_number)
);

create index invoices_firm_date_idx on crmpro.invoices (firm_id, invoice_date desc);

create table crmpro.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references crmpro.firms (id) on delete cascade,
  invoice_id uuid not null references crmpro.invoices (id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  paid_on date not null,
  mode text not null default 'bank',
  reference text,
  created_at timestamptz not null default now()
);

create table crmpro.time_entries (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references crmpro.firms (id) on delete cascade,
  user_id uuid not null references crmpro.profiles (id) on delete cascade,
  account_id uuid references crmpro.accounts (id) on delete set null,
  engagement_id uuid references crmpro.engagements (id) on delete set null,
  work_date date not null,
  minutes integer not null check (minutes > 0 and minutes <= 1440),
  description text,
  billable boolean not null default true,
  created_at timestamptz not null default now()
);

create index time_entries_firm_date_idx on crmpro.time_entries (firm_id, work_date desc);

create table crmpro.documents (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references crmpro.firms (id) on delete cascade,
  account_id uuid not null references crmpro.accounts (id) on delete cascade,
  financial_year text not null,
  folder text not null default 'General',
  name text not null,
  storage_path text not null,
  mime text,
  size_bytes integer,
  uploaded_by uuid,
  client_visible boolean not null default false,
  created_at timestamptz not null default now()
);

create index documents_account_idx on crmpro.documents (account_id, financial_year);

create table crmpro.document_requests (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references crmpro.firms (id) on delete cascade,
  account_id uuid not null references crmpro.accounts (id) on delete cascade,
  title text not null,
  financial_year text not null,
  folder text not null default 'Client uploads',
  status text not null default 'requested' check (status in ('requested', 'uploaded')),
  upload_token text not null unique,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Automation, messages, audit
-- ---------------------------------------------------------------------------

create table crmpro.workflow_rules (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references crmpro.firms (id) on delete cascade,
  name text not null,
  trigger_event text not null check (trigger_event in ('lead.created', 'deal.stage_changed')),
  actions jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table crmpro.message_templates (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references crmpro.firms (id) on delete cascade,
  channel text not null check (channel in ('email', 'whatsapp')),
  name text not null,
  subject text,
  body text not null,
  created_at timestamptz not null default now()
);

create table crmpro.outbound_messages (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references crmpro.firms (id) on delete cascade,
  channel text not null,
  recipient text not null,
  subject text,
  body text not null,
  status text not null,
  provider text not null,
  related_type text,
  related_id uuid,
  created_at timestamptz not null default now()
);

create table crmpro.notifications (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references crmpro.firms (id) on delete cascade,
  user_id uuid not null references crmpro.profiles (id) on delete cascade,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on crmpro.notifications (user_id, created_at desc);

create table crmpro.audit_logs (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references crmpro.firms (id) on delete cascade,
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  changes jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_firm_idx on crmpro.audit_logs (firm_id, created_at desc);

create table crmpro.web_forms (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references crmpro.firms (id) on delete cascade,
  name text not null,
  public_key text not null unique,
  default_owner_id uuid references crmpro.profiles (id) on delete set null,
  default_source text not null default 'web-form',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table crmpro.leads
  add constraint leads_web_form_fk foreign key (web_form_id) references crmpro.web_forms (id) on delete set null;
