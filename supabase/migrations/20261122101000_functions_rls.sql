-- Helpers, onboarding, audit, and row level security.
-- Every tenant policy keys off the signed-in user's firm. Client portal users
-- are a separate principal and can read only their own account.

create schema if not exists crmpro;
create schema if not exists crmpro_private;

create or replace function crmpro_private.current_firm_id()
returns uuid
language sql
stable
security definer
set search_path = crmpro, public
as $$
  select firm_id from crmpro.profiles where id = auth.uid()
$$;

create or replace function crmpro_private.current_role()
returns text
language sql
stable
security definer
set search_path = crmpro, public
as $$
  select role from crmpro.profiles where id = auth.uid()
$$;

create or replace function crmpro_private.can_write()
returns boolean
language sql
stable
security definer
set search_path = crmpro, public
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
set search_path = crmpro, public
as $$
  select firm_id from crmpro.client_users where id = auth.uid()
$$;

create or replace function crmpro_private.client_account_id()
returns uuid
language sql
stable
security definer
set search_path = crmpro, public
as $$
  select account_id from crmpro.client_users where id = auth.uid()
$$;

create or replace function crmpro_private.touch_updated_at()
returns trigger
language plpgsql
set search_path = crmpro, public
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
set search_path = crmpro, public
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
set search_path = crmpro, public
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
set search_path = crmpro, public
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

create or replace function crmpro.crmpro_create_firm(
  p_name text,
  p_city text,
  p_state_code text,
  p_gstin text,
  p_phone text
)
returns uuid
language plpgsql
security definer
set search_path = crmpro, public
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

create or replace function crmpro.crmpro_accept_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = crmpro, public
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

create or replace function crmpro.crmpro_accept_portal_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = crmpro, public
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
revoke all on schema crmpro_private from anon;
grant usage on schema crmpro_private to authenticated, service_role;
grant usage on schema crmpro to authenticated, service_role;
grant execute on function crmpro_private.current_firm_id() to authenticated;
grant execute on function crmpro_private.current_role() to authenticated;
grant execute on function crmpro_private.can_write() to authenticated;
grant execute on function crmpro_private.client_firm_id() to authenticated;
grant execute on function crmpro_private.client_account_id() to authenticated;
grant execute on function crmpro.crmpro_create_firm(text, text, text, text, text) to authenticated;
grant execute on function crmpro.crmpro_accept_invite(text) to authenticated;
grant execute on function crmpro.crmpro_accept_portal_invite(text) to authenticated;

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
    'saved_views', 'compliance_filings', 'invitations', 'portal_invites', 'contacts', 'accounts'
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
