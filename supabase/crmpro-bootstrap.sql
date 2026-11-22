-- CRMPro namespace bootstrap. Fresh install only; never seed shared production.
begin;
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

-- Helpers, onboarding, audit, and row level security.
-- Every tenant policy keys off the signed-in user's firm. Client portal users
-- are a separate principal and can read only their own account.

create schema crmpro_private;

create or replace function crmpro_private.current_firm_id()
returns uuid
language sql
stable
security definer
set search_path = crmpro
as $$
  select firm_id from crmpro.profiles where id = auth.uid()
$$;

create or replace function crmpro_private.current_role()
returns text
language sql
stable
security definer
set search_path = crmpro
as $$
  select role from crmpro.profiles where id = auth.uid()
$$;

create or replace function crmpro_private.can_write()
returns boolean
language sql
stable
security definer
set search_path = crmpro
as $$
  select exists (
    select 1 from crmpro.profiles
    where id = auth.uid() and role in ('owner', 'partner', 'staff')
  )
$$;

create or replace function crmpro_private.client_firm_id()
returns uuid
language sql
stable
security definer
set search_path = crmpro
as $$
  select firm_id from crmpro.client_users where id = auth.uid()
$$;

create or replace function crmpro_private.client_account_id()
returns uuid
language sql
stable
security definer
set search_path = crmpro
as $$
  select account_id from crmpro.client_users where id = auth.uid()
$$;

create or replace function crmpro_private.touch_updated_at()
returns trigger
language plpgsql
set search_path = crmpro
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function crmpro_private.audit_row()
returns trigger
language plpgsql
security definer
set search_path = crmpro
as $$
declare
  v_firm uuid;
  v_id uuid;
begin
  if tg_op = 'DELETE' then
    v_firm := old.firm_id;
    v_id := old.id;
  else
    v_firm := new.firm_id;
    v_id := new.id;
  end if;
  insert into crmpro.audit_logs (firm_id, actor_id, action, entity_type, entity_id, changes)
  values (
    v_firm,
    auth.uid(),
    lower(tg_op),
    tg_argv[0],
    v_id,
    case tg_op
      when 'INSERT' then jsonb_build_object('new', to_jsonb(new))
      when 'DELETE' then jsonb_build_object('old', to_jsonb(old))
      else jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new))
    end
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function crmpro_private.protect_billing()
returns trigger
language plpgsql
security definer
set search_path = crmpro
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.plan is distinct from old.plan
     or new.subscription_status is distinct from old.subscription_status
     or new.razorpay_customer_id is distinct from old.razorpay_customer_id
     or new.razorpay_subscription_id is distinct from old.razorpay_subscription_id
     or new.trial_ends_at is distinct from old.trial_ends_at then
    if crmpro_private.current_role() is distinct from 'owner' then
      raise exception 'Only the firm owner can change the subscription';
    end if;
  end if;
  return new;
end;
$$;

create or replace function crmpro_private.same_firm_stage()
returns trigger
language plpgsql
set search_path = crmpro
as $$
begin
  if not exists (
    select 1 from crmpro.pipeline_stages
    where id = new.stage_id and firm_id = new.firm_id
  ) then
    raise exception 'Deal stage is not in this firm';
  end if;
  return new;
end;
$$;

create or replace function crmpro_private.create_firm(
  p_name text,
  p_city text,
  p_state_code text,
  p_gstin text,
  p_phone text
)
returns uuid
language plpgsql
security definer
set search_path = crmpro
as $$
declare
  v_firm uuid;
  v_email text;
  v_name text;
  v_state text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if exists (select 1 from crmpro.profiles where id = auth.uid()) then
    raise exception 'This user already belongs to a firm';
  end if;
  if exists (select 1 from crmpro.client_users where id = auth.uid()) then
    raise exception 'Client portal users cannot open a firm';
  end if;

  select email, coalesce(raw_user_meta_data ->> 'full_name', split_part(email, '@', 1))
    into v_email, v_name
  from auth.users
  where id = auth.uid();

  v_state := coalesce(nullif(p_state_code, ''), '33');

  insert into crmpro.firms (name, city, state_code, gstin, phone, email, plan, subscription_status, trial_ends_at)
  values (
    trim(p_name),
    nullif(trim(p_city), ''),
    v_state,
    nullif(upper(trim(p_gstin)), ''),
    nullif(trim(p_phone), ''),
    v_email,
    'growth',
    'trialing',
    now() + interval '14 days'
  )
  returning id into v_firm;

  insert into crmpro.profiles (id, firm_id, full_name, email, phone, role)
  values (auth.uid(), v_firm, coalesce(nullif(v_name, ''), 'Owner'), v_email, nullif(trim(p_phone), ''), 'owner');

  insert into crmpro.pipeline_stages (firm_id, name, position, probability, is_won, is_lost, color)
  values
    (v_firm, 'New', 1, 10, false, false, '#c4b49a'),
    (v_firm, 'Qualified', 2, 30, false, false, '#7d9a8a'),
    (v_firm, 'Proposal', 3, 50, false, false, '#c4924a'),
    (v_firm, 'Negotiation', 4, 70, false, false, '#3d7a86'),
    (v_firm, 'Won', 5, 100, true, false, '#1c6b5a'),
    (v_firm, 'Lost', 6, 0, false, true, '#9b3a2f');

  insert into crmpro.workflow_rules (firm_id, name, trigger_event, actions)
  values (
    v_firm,
    'New lead: assign and call',
    'lead.created',
    jsonb_build_array(
      jsonb_build_object('type', 'assign_owner', 'userId', auth.uid()::text),
      jsonb_build_object('type', 'create_task', 'subject', 'Call new lead within a day', 'dueInDays', 1)
    )
  );

  insert into crmpro.web_forms (firm_id, name, public_key, default_owner_id)
  values (v_firm, 'Website enquiry', replace(gen_random_uuid()::text, '-', ''), auth.uid());

  return v_firm;
end;
$$;

create or replace function crmpro_private.accept_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = crmpro
as $$
declare
  v_invite crmpro.invitations%rowtype;
  v_email text;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if exists (select 1 from crmpro.profiles where id = auth.uid()) then
    raise exception 'This user already belongs to a firm';
  end if;

  select * into v_invite from crmpro.invitations
  where token = p_token and accepted_at is null and expires_at > now();
  if not found then
    raise exception 'Invite is missing or expired';
  end if;

  select email, coalesce(raw_user_meta_data ->> 'full_name', split_part(email, '@', 1))
    into v_email, v_name
  from auth.users where id = auth.uid();

  if lower(v_email) <> lower(v_invite.email) then
    raise exception 'Sign in with the invited email address';
  end if;

  insert into crmpro.profiles (id, firm_id, full_name, email, role)
  values (auth.uid(), v_invite.firm_id, v_name, v_email, v_invite.role);

  update crmpro.invitations set accepted_at = now() where id = v_invite.id;
  return v_invite.firm_id;
end;
$$;

create or replace function crmpro_private.accept_portal_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = crmpro
as $$
declare
  v_invite crmpro.portal_invites%rowtype;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if exists (select 1 from crmpro.profiles where id = auth.uid())
     or exists (select 1 from crmpro.client_users where id = auth.uid()) then
    raise exception 'This login is already linked';
  end if;

  select * into v_invite from crmpro.portal_invites
  where token = p_token and accepted_at is null;
  if not found then
    raise exception 'Portal invite is missing';
  end if;

  select email into v_email from auth.users where id = auth.uid();
  if lower(v_email) <> lower(v_invite.email) then
    raise exception 'Sign in with the invited email address';
  end if;

  insert into crmpro.client_users (id, firm_id, account_id)
  values (auth.uid(), v_invite.firm_id, v_invite.account_id);

  update crmpro.portal_invites set accepted_at = now() where id = v_invite.id;
  update crmpro.accounts set portal_enabled = true where id = v_invite.account_id;
  return v_invite.account_id;
end;
$$;

revoke all on schema crmpro_private from public;
grant usage on schema crmpro_private to authenticated, service_role;
grant execute on function crmpro_private.current_firm_id() to authenticated;
grant execute on function crmpro_private.current_role() to authenticated;
grant execute on function crmpro_private.can_write() to authenticated;
grant execute on function crmpro_private.client_firm_id() to authenticated;
grant execute on function crmpro_private.client_account_id() to authenticated;
grant execute on function crmpro_private.create_firm(text, text, text, text, text) to authenticated;
grant execute on function crmpro_private.accept_invite(text) to authenticated;
grant execute on function crmpro_private.accept_portal_invite(text) to authenticated;

-- Triggers
create trigger firms_touch before update on crmpro.firms
for each row execute function crmpro_private.touch_updated_at();
create trigger firms_billing before update on crmpro.firms
for each row execute function crmpro_private.protect_billing();
create trigger accounts_touch before update on crmpro.accounts
for each row execute function crmpro_private.touch_updated_at();
create trigger contacts_touch before update on crmpro.contacts
for each row execute function crmpro_private.touch_updated_at();
create trigger leads_touch before update on crmpro.leads
for each row execute function crmpro_private.touch_updated_at();
create trigger deals_touch before update on crmpro.deals
for each row execute function crmpro_private.touch_updated_at();
create trigger deals_stage before insert or update of stage_id, firm_id on crmpro.deals
for each row execute function crmpro_private.same_firm_stage();

create trigger audit_leads after insert or update or delete on crmpro.leads
for each row execute function crmpro_private.audit_row('lead');
create trigger audit_contacts after insert or update or delete on crmpro.contacts
for each row execute function crmpro_private.audit_row('contact');
create trigger audit_accounts after insert or update or delete on crmpro.accounts
for each row execute function crmpro_private.audit_row('account');
create trigger audit_deals after insert or update or delete on crmpro.deals
for each row execute function crmpro_private.audit_row('deal');
create trigger audit_invoices after insert or update or delete on crmpro.invoices
for each row execute function crmpro_private.audit_row('invoice');
create trigger audit_filings after insert or update or delete on crmpro.compliance_filings
for each row execute function crmpro_private.audit_row('filing');
create trigger audit_profiles after insert or update or delete on crmpro.profiles
for each row execute function crmpro_private.audit_row('profile');

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'firms', 'profiles', 'accounts', 'contacts', 'client_users', 'invitations', 'portal_invites',
    'leads', 'pipeline_stages', 'deals', 'activities', 'tags', 'record_tags', 'custom_field_defs',
    'saved_views', 'compliance_rules', 'compliance_rule_periods', 'compliance_filings',
    'engagements', 'invoices', 'invoice_payments', 'time_entries', 'documents', 'document_requests',
    'workflow_rules', 'message_templates', 'outbound_messages', 'notifications', 'audit_logs', 'web_forms'
  ]
  loop
    execute format('alter table crmpro.%I enable row level security', t);
  end loop;
end $$;

-- Staff can read their firm. Writers can change rows. Read-only cannot.
-- Applied to ordinary firm-scoped tables.

do $$
declare
  t text;
begin
  foreach t in array array[
    'leads', 'deals', 'activities', 'tags', 'record_tags', 'engagements', 'invoices',
    'invoice_payments', 'time_entries', 'documents', 'document_requests', 'workflow_rules',
    'message_templates', 'outbound_messages', 'web_forms', 'pipeline_stages', 'custom_field_defs',
    'saved_views', 'compliance_filings', 'contacts', 'accounts'
  ]
  loop
    execute format(
      'create policy %I on crmpro.%I for select to authenticated using (firm_id = crmpro_private.current_firm_id())',
      t || '_staff_select', t
    );
    execute format(
      'create policy %I on crmpro.%I for insert to authenticated with check (firm_id = crmpro_private.current_firm_id() and crmpro_private.can_write())',
      t || '_staff_insert', t
    );
    execute format(
      'create policy %I on crmpro.%I for update to authenticated using (firm_id = crmpro_private.current_firm_id() and crmpro_private.can_write()) with check (firm_id = crmpro_private.current_firm_id() and crmpro_private.can_write())',
      t || '_staff_update', t
    );
    execute format(
      'create policy %I on crmpro.%I for delete to authenticated using (firm_id = crmpro_private.current_firm_id() and crmpro_private.can_write())',
      t || '_staff_delete', t
    );
  end loop;
end $$;

-- Firm profile
create policy firms_select on crmpro.firms for select to authenticated
using (id = crmpro_private.current_firm_id() or id = crmpro_private.client_firm_id());

create policy firms_update on crmpro.firms for update to authenticated
using (id = crmpro_private.current_firm_id() and crmpro_private.current_role() in ('owner', 'partner'))
with check (id = crmpro_private.current_firm_id() and crmpro_private.current_role() in ('owner', 'partner'));

-- Profiles: members of the firm can read. Role changes are limited below.
create policy profiles_select on crmpro.profiles for select to authenticated
using (firm_id = crmpro_private.current_firm_id());

create policy profiles_update_self on crmpro.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid() and firm_id = crmpro_private.current_firm_id() and role = crmpro_private.current_role());

create policy profiles_update_managers on crmpro.profiles for update to authenticated
using (firm_id = crmpro_private.current_firm_id() and crmpro_private.current_role() in ('owner', 'partner'))
with check (firm_id = crmpro_private.current_firm_id() and crmpro_private.current_role() in ('owner', 'partner'));

-- Client portal. Additional select policies OR with the staff policies.
create policy accounts_client_select on crmpro.accounts for select to authenticated
using (id = crmpro_private.client_account_id());

create policy contacts_client_select on crmpro.contacts for select to authenticated
using (account_id = crmpro_private.client_account_id() and deleted_at is null);

create policy filings_client_select on crmpro.compliance_filings for select to authenticated
using (account_id = crmpro_private.client_account_id());

create policy invoices_client_select on crmpro.invoices for select to authenticated
using (account_id = crmpro_private.client_account_id() and status <> 'draft');

create policy payments_client_select on crmpro.invoice_payments for select to authenticated
using (
  invoice_id in (
    select id from crmpro.invoices
    where account_id = crmpro_private.client_account_id() and status <> 'draft'
  )
);

create policy documents_client_select on crmpro.documents for select to authenticated
using (account_id = crmpro_private.client_account_id() and client_visible);

create policy requests_client_select on crmpro.document_requests for select to authenticated
using (account_id = crmpro_private.client_account_id());

create policy client_users_select on crmpro.client_users for select to authenticated
using (firm_id = crmpro_private.current_firm_id() or id = auth.uid());

-- System compliance rules are readable by every signed-in firm member.
-- A firm may insert its own override. System rows (firm_id null) are not writable.
create policy rules_select on crmpro.compliance_rules for select to authenticated
using (firm_id is null or firm_id = crmpro_private.current_firm_id());

create policy rules_insert on crmpro.compliance_rules for insert to authenticated
with check (firm_id = crmpro_private.current_firm_id() and crmpro_private.current_role() in ('owner', 'partner'));

create policy rules_update on crmpro.compliance_rules for update to authenticated
using (firm_id = crmpro_private.current_firm_id() and crmpro_private.current_role() in ('owner', 'partner'))
with check (firm_id = crmpro_private.current_firm_id() and crmpro_private.current_role() in ('owner', 'partner'));

create policy rules_delete on crmpro.compliance_rules for delete to authenticated
using (firm_id = crmpro_private.current_firm_id() and crmpro_private.current_role() in ('owner', 'partner'));

create policy rule_periods_select on crmpro.compliance_rule_periods for select to authenticated
using (
  exists (
    select 1 from crmpro.compliance_rules r
    where r.id = rule_id and (r.firm_id is null or r.firm_id = crmpro_private.current_firm_id())
  )
);

create policy rule_periods_write on crmpro.compliance_rule_periods for all to authenticated
using (
  exists (
    select 1 from crmpro.compliance_rules r
    where r.id = rule_id and r.firm_id = crmpro_private.current_firm_id() and crmpro_private.current_role() in ('owner', 'partner')
  )
)
with check (
  exists (
    select 1 from crmpro.compliance_rules r
    where r.id = rule_id and r.firm_id = crmpro_private.current_firm_id() and crmpro_private.current_role() in ('owner', 'partner')
  )
);

create policy notifications_select on crmpro.notifications for select to authenticated
using (user_id = auth.uid());

create policy notifications_update on crmpro.notifications for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy audit_select on crmpro.audit_logs for select to authenticated
using (firm_id = crmpro_private.current_firm_id());

-- Documents live under {firm_id}/... so a firm cannot read another firm's objects.
insert into storage.buckets (id, name, public, file_size_limit)
values ('crmpro_documents', 'crmpro_documents', false, 20971520)
on conflict (id) do nothing;

create policy crmpro_documents_storage_read on storage.objects for select to authenticated
using (
  bucket_id = 'crmpro_documents'
  and (storage.foldername(name))[1] = crmpro_private.current_firm_id()::text
);

create policy crmpro_documents_storage_write on storage.objects for insert to authenticated
with check (
  bucket_id = 'crmpro_documents'
  and (storage.foldername(name))[1] = crmpro_private.current_firm_id()::text
  and crmpro_private.can_write()
);

create policy crmpro_documents_storage_update on storage.objects for update to authenticated
using (
  bucket_id = 'crmpro_documents'
  and (storage.foldername(name))[1] = crmpro_private.current_firm_id()::text
  and crmpro_private.can_write()
);

create policy crmpro_documents_storage_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'crmpro_documents'
  and (storage.foldername(name))[1] = crmpro_private.current_firm_id()::text
  and crmpro_private.can_write()
);

grant select, insert, update, delete on all tables in schema crmpro to authenticated, service_role;
grant usage, select on all sequences in schema crmpro to authenticated, service_role;

-- Generated from src/lib/compliance/rules.ts. Re-run: node --experimental-strip-types scripts/build-rules-sql.ts
insert into crmpro.compliance_rules (id, firm_id, code, variant, name, frequency, entity_types, gst_frequencies, requires_gstin, audit_mode, state_codes, notes)
values
  ('d1000000-0000-4000-8000-000000000001', null, 'GSTR1', 'monthly', 'GSTR-1', 'monthly', null, array['monthly']::text[], true, 'any', null, 'Monthly statement of outward supplies. Due on the 11th of the following month.'),
  ('d1000000-0000-4000-8000-000000000002', null, 'GSTR1', 'quarterly', 'GSTR-1 (QRMP)', 'quarterly', null, array['quarterly']::text[], true, 'any', null, 'Quarterly GSTR-1 for QRMP taxpayers. Due on the 13th of the month after the quarter.'),
  ('d1000000-0000-4000-8000-000000000003', null, 'GSTR3B', 'monthly', 'GSTR-3B', 'monthly', null, array['monthly']::text[], true, 'any', null, 'Monthly summary return. Due on the 20th of the following month.'),
  ('d1000000-0000-4000-8000-000000000004', null, 'GSTR3B', 'qrmp-22', 'GSTR-3B (QRMP)', 'quarterly', null, array['quarterly']::text[], true, 'any', array['22', '23', '24', '26', '27', '29', '30', '31', '32', '33', '34', '35', '36', '37']::text[], 'QRMP GSTR-3B for category states including Tamil Nadu. Due on the 22nd.'),
  ('d1000000-0000-4000-8000-000000000005', null, 'GSTR3B', 'qrmp-24', 'GSTR-3B (QRMP)', 'quarterly', null, array['quarterly']::text[], true, 'any', array['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '38']::text[], 'QRMP GSTR-3B for the remaining states and Delhi. Due on the 24th.'),
  ('d1000000-0000-4000-8000-000000000006', null, 'TDS', 'quarterly', 'TDS return (24Q/26Q)', 'quarterly', array['proprietorship', 'partnership', 'huf', 'llp', 'pvt_ltd', 'public_ltd', 'trust', 'society']::text[], null, false, 'any', null, 'Quarterly TDS statements. Q4 is due on 31 May, not the month after March.'),
  ('d1000000-0000-4000-8000-000000000007', null, 'ADV_TAX', 'installments', 'Advance tax', 'installment', null, null, false, 'any', null, '15 June 15%, 15 September 45%, 15 December 75%, 15 March 100%.'),
  ('d1000000-0000-4000-8000-000000000008', null, 'ITR', 'non-audit', 'Income-tax return', 'annual', array['individual', 'proprietorship', 'huf', 'partnership', 'trust', 'society']::text[], null, false, 'non_audit', null, 'Non-audit return. Default due date 31 July of the assessment year. Extend by editing the rule when CBDT notifies.'),
  ('d1000000-0000-4000-8000-000000000009', null, 'ITR', 'audit', 'Income-tax return (audit)', 'annual', array['partnership', 'llp', 'pvt_ltd', 'public_ltd', 'trust', 'society']::text[], null, false, 'audit', null, 'Audit cases. Default due date 31 October.'),
  ('d1000000-0000-4000-8000-000000000010', null, 'MCA_AOC4', 'annual', 'AOC-4', 'annual', array['pvt_ltd', 'public_ltd']::text[], null, false, 'any', null, 'Financial statements with ROC. Default assumes AGM by 30 September, filing within 30 days (30 October).'),
  ('d1000000-0000-4000-8000-000000000011', null, 'MCA_MGT7', 'annual', 'MGT-7', 'annual', array['pvt_ltd', 'public_ltd']::text[], null, false, 'any', null, 'Annual return with ROC. Default assumes 60 days from a 30 September AGM (29 November).'),
  ('d1000000-0000-4000-8000-000000000012', null, 'LLP_8', 'annual', 'LLP Form 8', 'annual', array['llp']::text[], null, false, 'any', null, 'Statement of Account & Solvency. Due 30 October.'),
  ('d1000000-0000-4000-8000-000000000013', null, 'LLP_11', 'annual', 'LLP Form 11', 'annual', array['llp']::text[], null, false, 'any', null, 'Annual return of LLP. Due 30 May.');
insert into crmpro.compliance_rule_periods (rule_id, period_key, label, start_month, start_year_offset, end_month, end_year_offset, due_month, due_day, due_year_offset, sort)
values
  ('d1000000-0000-4000-8000-000000000001', 'M04', 'Apr {{y0}}', 4, 0, 4, 0, 5, 11, 0, 1),
  ('d1000000-0000-4000-8000-000000000001', 'M05', 'May {{y0}}', 5, 0, 5, 0, 6, 11, 0, 2),
  ('d1000000-0000-4000-8000-000000000001', 'M06', 'Jun {{y0}}', 6, 0, 6, 0, 7, 11, 0, 3),
  ('d1000000-0000-4000-8000-000000000001', 'M07', 'Jul {{y0}}', 7, 0, 7, 0, 8, 11, 0, 4),
  ('d1000000-0000-4000-8000-000000000001', 'M08', 'Aug {{y0}}', 8, 0, 8, 0, 9, 11, 0, 5),
  ('d1000000-0000-4000-8000-000000000001', 'M09', 'Sep {{y0}}', 9, 0, 9, 0, 10, 11, 0, 6),
  ('d1000000-0000-4000-8000-000000000001', 'M10', 'Oct {{y0}}', 10, 0, 10, 0, 11, 11, 0, 7),
  ('d1000000-0000-4000-8000-000000000001', 'M11', 'Nov {{y0}}', 11, 0, 11, 0, 12, 11, 0, 8),
  ('d1000000-0000-4000-8000-000000000001', 'M12', 'Dec {{y0}}', 12, 0, 12, 0, 1, 11, 1, 9),
  ('d1000000-0000-4000-8000-000000000001', 'M01', 'Jan {{y1}}', 1, 1, 1, 1, 2, 11, 1, 10),
  ('d1000000-0000-4000-8000-000000000001', 'M02', 'Feb {{y1}}', 2, 1, 2, 1, 3, 11, 1, 11),
  ('d1000000-0000-4000-8000-000000000001', 'M03', 'Mar {{y1}}', 3, 1, 3, 1, 4, 11, 1, 12),
  ('d1000000-0000-4000-8000-000000000002', 'Q1', 'Q1 {{fy}} (Apr–Jun)', 4, 0, 6, 0, 7, 13, 0, 1),
  ('d1000000-0000-4000-8000-000000000002', 'Q2', 'Q2 {{fy}} (Jul–Sep)', 7, 0, 9, 0, 10, 13, 0, 2),
  ('d1000000-0000-4000-8000-000000000002', 'Q3', 'Q3 {{fy}} (Oct–Dec)', 10, 0, 12, 0, 1, 13, 1, 3),
  ('d1000000-0000-4000-8000-000000000002', 'Q4', 'Q4 {{fy}} (Jan–Mar)', 1, 1, 3, 1, 4, 13, 1, 4),
  ('d1000000-0000-4000-8000-000000000003', 'M04', 'Apr {{y0}}', 4, 0, 4, 0, 5, 20, 0, 1),
  ('d1000000-0000-4000-8000-000000000003', 'M05', 'May {{y0}}', 5, 0, 5, 0, 6, 20, 0, 2),
  ('d1000000-0000-4000-8000-000000000003', 'M06', 'Jun {{y0}}', 6, 0, 6, 0, 7, 20, 0, 3),
  ('d1000000-0000-4000-8000-000000000003', 'M07', 'Jul {{y0}}', 7, 0, 7, 0, 8, 20, 0, 4),
  ('d1000000-0000-4000-8000-000000000003', 'M08', 'Aug {{y0}}', 8, 0, 8, 0, 9, 20, 0, 5),
  ('d1000000-0000-4000-8000-000000000003', 'M09', 'Sep {{y0}}', 9, 0, 9, 0, 10, 20, 0, 6),
  ('d1000000-0000-4000-8000-000000000003', 'M10', 'Oct {{y0}}', 10, 0, 10, 0, 11, 20, 0, 7),
  ('d1000000-0000-4000-8000-000000000003', 'M11', 'Nov {{y0}}', 11, 0, 11, 0, 12, 20, 0, 8),
  ('d1000000-0000-4000-8000-000000000003', 'M12', 'Dec {{y0}}', 12, 0, 12, 0, 1, 20, 1, 9),
  ('d1000000-0000-4000-8000-000000000003', 'M01', 'Jan {{y1}}', 1, 1, 1, 1, 2, 20, 1, 10),
  ('d1000000-0000-4000-8000-000000000003', 'M02', 'Feb {{y1}}', 2, 1, 2, 1, 3, 20, 1, 11),
  ('d1000000-0000-4000-8000-000000000003', 'M03', 'Mar {{y1}}', 3, 1, 3, 1, 4, 20, 1, 12),
  ('d1000000-0000-4000-8000-000000000004', 'Q1', 'Q1 {{fy}} (Apr–Jun)', 4, 0, 6, 0, 7, 22, 0, 1),
  ('d1000000-0000-4000-8000-000000000004', 'Q2', 'Q2 {{fy}} (Jul–Sep)', 7, 0, 9, 0, 10, 22, 0, 2),
  ('d1000000-0000-4000-8000-000000000004', 'Q3', 'Q3 {{fy}} (Oct–Dec)', 10, 0, 12, 0, 1, 22, 1, 3),
  ('d1000000-0000-4000-8000-000000000004', 'Q4', 'Q4 {{fy}} (Jan–Mar)', 1, 1, 3, 1, 4, 22, 1, 4),
  ('d1000000-0000-4000-8000-000000000005', 'Q1', 'Q1 {{fy}} (Apr–Jun)', 4, 0, 6, 0, 7, 24, 0, 1),
  ('d1000000-0000-4000-8000-000000000005', 'Q2', 'Q2 {{fy}} (Jul–Sep)', 7, 0, 9, 0, 10, 24, 0, 2),
  ('d1000000-0000-4000-8000-000000000005', 'Q3', 'Q3 {{fy}} (Oct–Dec)', 10, 0, 12, 0, 1, 24, 1, 3),
  ('d1000000-0000-4000-8000-000000000005', 'Q4', 'Q4 {{fy}} (Jan–Mar)', 1, 1, 3, 1, 4, 24, 1, 4),
  ('d1000000-0000-4000-8000-000000000006', 'Q1', 'Q1 {{fy}} (Apr–Jun)', 4, 0, 6, 0, 7, 31, 0, 1),
  ('d1000000-0000-4000-8000-000000000006', 'Q2', 'Q2 {{fy}} (Jul–Sep)', 7, 0, 9, 0, 10, 31, 0, 2),
  ('d1000000-0000-4000-8000-000000000006', 'Q3', 'Q3 {{fy}} (Oct–Dec)', 10, 0, 12, 0, 1, 31, 1, 3),
  ('d1000000-0000-4000-8000-000000000006', 'Q4', 'Q4 {{fy}} (Jan–Mar)', 1, 1, 3, 1, 5, 31, 1, 4),
  ('d1000000-0000-4000-8000-000000000007', 'ADV1', '15 Jun {{y0}} · 15%', 4, 0, 6, 0, 6, 15, 0, 1),
  ('d1000000-0000-4000-8000-000000000007', 'ADV2', '15 Sep {{y0}} · 45%', 7, 0, 9, 0, 9, 15, 0, 2),
  ('d1000000-0000-4000-8000-000000000007', 'ADV3', '15 Dec {{y0}} · 75%', 10, 0, 12, 0, 12, 15, 0, 3),
  ('d1000000-0000-4000-8000-000000000007', 'ADV4', '15 Mar {{y1}} · 100%', 1, 1, 3, 1, 3, 15, 1, 4),
  ('d1000000-0000-4000-8000-000000000008', 'FY', 'ITR {{fy}}', 4, 0, 3, 1, 7, 31, 1, 1),
  ('d1000000-0000-4000-8000-000000000009', 'FY', 'ITR (audit) {{fy}}', 4, 0, 3, 1, 10, 31, 1, 1),
  ('d1000000-0000-4000-8000-000000000010', 'FY', 'AOC-4 {{fy}}', 4, 0, 3, 1, 10, 30, 1, 1),
  ('d1000000-0000-4000-8000-000000000011', 'FY', 'MGT-7 {{fy}}', 4, 0, 3, 1, 11, 29, 1, 1),
  ('d1000000-0000-4000-8000-000000000012', 'FY', 'LLP Form 8 {{fy}}', 4, 0, 3, 1, 10, 30, 1, 1),
  ('d1000000-0000-4000-8000-000000000013', 'FY', 'LLP Form 11 {{fy}}', 4, 0, 3, 1, 5, 30, 1, 1);

-- API entry points live with CRM data; internal helpers are never exposed.
revoke execute on all functions in schema crmpro_private from public, anon;
grant usage on schema crmpro_private to authenticated, service_role;

create function crmpro.crmpro_create_firm(p_name text, p_city text, p_state_code text, p_gstin text, p_phone text)
returns uuid language sql security invoker set search_path = ''
as $$ select crmpro_private.create_firm(p_name, p_city, p_state_code, p_gstin, p_phone) $$;
create function crmpro.crmpro_accept_invite(p_token text)
returns uuid language sql security invoker set search_path = ''
as $$ select crmpro_private.accept_invite(p_token) $$;
create function crmpro.crmpro_accept_portal_invite(p_token text)
returns uuid language sql security invoker set search_path = ''
as $$ select crmpro_private.accept_portal_invite(p_token) $$;
revoke execute on all functions in schema crmpro from public, anon;
grant execute on all functions in schema crmpro to authenticated, service_role;

-- Only the owner can manage staff invitations. Portal invites are for managers.
create policy invitations_manager on crmpro.invitations for all to authenticated
using (firm_id = crmpro_private.current_firm_id() and crmpro_private.current_role() = 'owner')
with check (firm_id = crmpro_private.current_firm_id() and crmpro_private.current_role() = 'owner');
create policy portal_invites_manager on crmpro.portal_invites for all to authenticated
using (firm_id = crmpro_private.current_firm_id() and crmpro_private.current_role() in ('owner','partner'))
with check (firm_id = crmpro_private.current_firm_id() and crmpro_private.current_role() in ('owner','partner'));

drop policy profiles_update_managers on crmpro.profiles;
create policy profiles_update_managers on crmpro.profiles for update to authenticated
using (firm_id = crmpro_private.current_firm_id() and crmpro_private.current_role() = 'owner' and id <> auth.uid())
with check (firm_id = crmpro_private.current_firm_id() and crmpro_private.current_role() = 'owner' and id <> auth.uid() and role in ('partner','staff','readonly'));

-- Restrict storage replacement both before and after an update.
drop policy crmpro_documents_storage_update on storage.objects;
create policy crmpro_documents_storage_update on storage.objects for update to authenticated
using (bucket_id = 'crmpro_documents' and (storage.foldername(name))[1] = crmpro_private.current_firm_id()::text and crmpro_private.can_write())
with check (bucket_id = 'crmpro_documents' and (storage.foldername(name))[1] = crmpro_private.current_firm_id()::text and crmpro_private.can_write());

-- Relationships must stay within a tenant even when a user knows another UUID.
do $$
declare r record;
begin
  for r in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='crmpro' and c.relkind='r'
      and exists (select 1 from pg_attribute a where a.attrelid=c.oid and a.attname='firm_id' and not a.attisdropped)
      and exists (select 1 from pg_attribute a where a.attrelid=c.oid and a.attname='id' and not a.attisdropped)
  loop
    execute format('alter table crmpro.%I add constraint %I unique (firm_id,id)',r.relname,'crmpro_'||r.relname||'_firm_id_id_key');
  end loop;
  for r in
    select child.relname child_table, parent.relname parent_table, ca.attname child_column, fk.oid
    from pg_constraint fk
    join pg_class child on child.oid=fk.conrelid
    join pg_namespace cn on cn.oid=child.relnamespace
    join pg_class parent on parent.oid=fk.confrelid
    join pg_namespace pn on pn.oid=parent.relnamespace
    join pg_attribute ca on ca.attrelid=child.oid and ca.attnum=fk.conkey[1]
    join pg_attribute pa on pa.attrelid=parent.oid and pa.attnum=fk.confkey[1]
    where fk.contype='f' and array_length(fk.conkey,1)=1 and pa.attname='id'
      and cn.nspname='crmpro' and pn.nspname='crmpro' and ca.attname <> 'firm_id'
      and exists (select 1 from pg_attribute a where a.attrelid=child.oid and a.attname='firm_id' and not a.attisdropped)
      and exists (select 1 from pg_attribute a where a.attrelid=parent.oid and a.attname='firm_id' and not a.attisdropped)
  loop
    execute format('alter table crmpro.%I add constraint %I foreign key (firm_id,%I) references crmpro.%I (firm_id,id)',
      r.child_table,'crmpro_tenant_fk_'||r.oid,r.child_column,r.parent_table);
  end loop;
end $$;

-- New namespace only; do not change grants on any existing application's tables.
revoke all on all tables in schema crmpro from anon;

-- Existing permissive storage policies are OR-ed. These restrictive gates
-- protect only the new bucket and evaluate true for every other bucket.
create policy crmpro_storage_gate_read on storage.objects as restrictive for select to authenticated
using (bucket_id <> 'crmpro_documents' or (storage.foldername(name))[1] = crmpro_private.current_firm_id()::text);
create policy crmpro_storage_gate_insert on storage.objects as restrictive for insert to authenticated
with check (bucket_id <> 'crmpro_documents' or ((storage.foldername(name))[1] = crmpro_private.current_firm_id()::text and crmpro_private.can_write()));
create policy crmpro_storage_gate_update on storage.objects as restrictive for update to authenticated
using (bucket_id <> 'crmpro_documents' or ((storage.foldername(name))[1] = crmpro_private.current_firm_id()::text and crmpro_private.can_write()))
with check (bucket_id <> 'crmpro_documents' or ((storage.foldername(name))[1] = crmpro_private.current_firm_id()::text and crmpro_private.can_write()));
create policy crmpro_storage_gate_delete on storage.objects as restrictive for delete to authenticated
using (bucket_id <> 'crmpro_documents' or ((storage.foldername(name))[1] = crmpro_private.current_firm_id()::text and crmpro_private.can_write()));
create policy crmpro_storage_gate_anon on storage.objects as restrictive for all to anon
using (bucket_id <> 'crmpro_documents') with check (bucket_id <> 'crmpro_documents');
notify pgrst, 'reload schema';

commit;
