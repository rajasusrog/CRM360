-- Additive AI Copilot metadata tables in crmpro.
-- Stores firm opt-in settings, durable usage/rate-limit metadata (no raw prompts/outputs),
-- idempotent task extraction batches, and user helpfulness feedback.

create table if not exists crmpro.ai_firm_settings (
  firm_id uuid primary key references crmpro.firms (id) on delete cascade,
  enabled boolean not null default false,
  notice_accepted_at timestamptz,
  notice_accepted_by uuid references crmpro.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists crmpro.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references crmpro.firms (id) on delete cascade,
  user_id uuid not null references crmpro.profiles (id) on delete cascade,
  feature text not null check (feature in ('briefing', 'follow_up', 'notes_to_tasks')),
  request_id text not null,
  status text not null check (status in ('ok', 'rate_limited', 'provider_error', 'validation_error')),
  model_id text not null,
  input_chars integer not null default 0 check (input_chars >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_events_firm_created_idx
  on crmpro.ai_usage_events (firm_id, created_at desc);

create index if not exists ai_usage_events_user_created_idx
  on crmpro.ai_usage_events (user_id, created_at desc);

create table if not exists crmpro.ai_task_batches (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references crmpro.firms (id) on delete cascade,
  user_id uuid not null references crmpro.profiles (id) on delete cascade,
  idempotency_key text not null,
  related_type text check (related_type is null or related_type in ('lead', 'contact', 'account', 'deal', 'filing', 'invoice')),
  related_id uuid,
  created_activity_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (firm_id, idempotency_key)
);

create index if not exists ai_task_batches_firm_created_idx
  on crmpro.ai_task_batches (firm_id, created_at desc);

create table if not exists crmpro.ai_feedback (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references crmpro.firms (id) on delete cascade,
  user_id uuid not null references crmpro.profiles (id) on delete cascade,
  feature text not null check (feature in ('briefing', 'follow_up', 'notes_to_tasks')),
  request_id text not null,
  helpful boolean not null,
  comment text check (comment is null or char_length(comment) <= 300),
  created_at timestamptz not null default now()
);

create index if not exists ai_feedback_firm_created_idx
  on crmpro.ai_feedback (firm_id, created_at desc);

drop trigger if exists ai_firm_settings_touch on crmpro.ai_firm_settings;
create trigger ai_firm_settings_touch before update on crmpro.ai_firm_settings
for each row execute function crmpro_private.touch_updated_at();

alter table crmpro.ai_firm_settings enable row level security;
alter table crmpro.ai_usage_events enable row level security;
alter table crmpro.ai_task_batches enable row level security;
alter table crmpro.ai_feedback enable row level security;

-- Firm AI settings: firm staff can read; owners and partners can enable/disable.
create policy ai_firm_settings_select on crmpro.ai_firm_settings for select to authenticated
using (firm_id = crmpro_private.current_firm_id());

create policy ai_firm_settings_insert on crmpro.ai_firm_settings for insert to authenticated
with check (
  firm_id = crmpro_private.current_firm_id()
  and crmpro_private.current_role() in ('owner', 'partner')
);

create policy ai_firm_settings_update on crmpro.ai_firm_settings for update to authenticated
using (
  firm_id = crmpro_private.current_firm_id()
  and crmpro_private.current_role() in ('owner', 'partner')
)
with check (
  firm_id = crmpro_private.current_firm_id()
  and crmpro_private.current_role() in ('owner', 'partner')
);

-- Metadata-only usage ledger: staff can read firm totals; writers record their own events.
create policy ai_usage_events_select on crmpro.ai_usage_events for select to authenticated
using (firm_id = crmpro_private.current_firm_id());

create policy ai_usage_events_insert on crmpro.ai_usage_events for insert to authenticated
with check (
  firm_id = crmpro_private.current_firm_id()
  and user_id = auth.uid()
  and crmpro_private.can_write()
);

-- Idempotent task creation batches.
create policy ai_task_batches_select on crmpro.ai_task_batches for select to authenticated
using (firm_id = crmpro_private.current_firm_id());

create policy ai_task_batches_insert on crmpro.ai_task_batches for insert to authenticated
with check (
  firm_id = crmpro_private.current_firm_id()
  and user_id = auth.uid()
  and crmpro_private.can_write()
);

-- Feedback rows.
create policy ai_feedback_select on crmpro.ai_feedback for select to authenticated
using (firm_id = crmpro_private.current_firm_id());

create policy ai_feedback_insert on crmpro.ai_feedback for insert to authenticated
with check (
  firm_id = crmpro_private.current_firm_id()
  and user_id = auth.uid()
  and crmpro_private.can_write()
);

grant select, insert, update on crmpro.ai_firm_settings, crmpro.ai_usage_events, crmpro.ai_task_batches, crmpro.ai_feedback
  to authenticated, service_role;
