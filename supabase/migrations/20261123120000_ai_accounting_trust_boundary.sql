-- Additive migration: server-authorized AI usage finalization, lease-expiry
-- late-completion quota re-checks, and caller/payload-bound task idempotency.

alter table crmpro.ai_usage_events
  add column if not exists lease_expires_at timestamptz;

update crmpro.ai_usage_events
set lease_expires_at = created_at + interval '2 minutes'
where status = 'reserved'
  and lease_expires_at is null;

drop index if exists crmpro.ai_usage_events_firm_quota_idx;
create index if not exists ai_usage_events_firm_quota_idx
  on crmpro.ai_usage_events (firm_id, created_at desc, lease_expires_at)
  where status in ('reserved', 'ok');

alter table crmpro.ai_task_batches
  add column if not exists payload_hash text;

-- Drop old client-executable 3-arg finalize RPC so authenticated clients cannot invoke it.
drop function if exists crmpro.crmpro_finalize_ai_usage(uuid, text, integer);

create or replace function crmpro.crmpro_reserve_ai_quota(
  p_feature text,
  p_request_id text,
  p_model_id text,
  p_input_chars integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = crmpro, public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile crmpro.profiles%rowtype;
  v_firm crmpro.firms%rowtype;
  v_settings crmpro.ai_firm_settings%rowtype;
  v_now timestamptz := now();
  v_day_start timestamptz;
  v_lease_expires_at timestamptz := v_now + interval '2 minutes';
  v_burst_cutoff timestamptz := v_now - interval '10 minutes';
  v_daily_quota integer;
  v_burst_limit integer := 10;
  v_used_today integer := 0;
  v_burst_used integer := 0;
  v_event_id uuid;
  v_req_id text := trim(coalesce(p_request_id, ''));
  v_model text := trim(coalesce(p_model_id, ''));
  v_chars integer := greatest(0, coalesce(p_input_chars, 0));
begin
  if v_uid is null then
    return jsonb_build_object(
      'allowed', false,
      'code', 'unauthorized',
      'error', 'Sign in to use AI Copilot.'
    );
  end if;

  if p_feature is null or p_feature not in ('briefing', 'follow_up', 'notes_to_tasks') then
    raise exception 'Invalid AI feature parameter' using errcode = '22023';
  end if;

  if char_length(v_req_id) < 4 or char_length(v_req_id) > 128 then
    raise exception 'Invalid AI request identifier' using errcode = '22023';
  end if;

  if char_length(v_model) < 1 or char_length(v_model) > 128 then
    raise exception 'Invalid AI model identifier' using errcode = '22023';
  end if;

  select * into v_profile
  from crmpro.profiles
  where id = v_uid;

  if not found or v_profile.role not in ('owner', 'partner', 'staff') then
    return jsonb_build_object(
      'allowed', false,
      'code', 'forbidden',
      'error', 'AI Copilot is available to active firm writers only.'
    );
  end if;

  perform pg_advisory_xact_lock(hashtextextended('ai_quota:' || v_profile.firm_id::text, 0));

  select * into v_firm
  from crmpro.firms
  where id = v_profile.firm_id;

  if not found then
    return jsonb_build_object(
      'allowed', false,
      'code', 'forbidden',
      'error', 'Active firm record was not found.'
    );
  end if;

  select * into v_settings
  from crmpro.ai_firm_settings
  where firm_id = v_profile.firm_id;

  if not found or not v_settings.enabled or v_settings.notice_accepted_at is null then
    return jsonb_build_object(
      'allowed', false,
      'code', 'disabled',
      'error', 'AI Copilot is disabled for this firm. An owner or partner can enable it in Settings.'
    );
  end if;

  v_daily_quota := case
    when v_firm.subscription_status = 'trialing'
         and v_firm.trial_ends_at is not null
         and v_firm.trial_ends_at > v_now then 150
    when v_firm.subscription_status = 'cancelled' then 25
    when v_firm.plan = 'pro' then 500
    when v_firm.plan = 'growth' then 150
    else 25
  end;

  v_day_start := (date_trunc('day', v_now at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata');

  select count(*)::integer into v_used_today
  from crmpro.ai_usage_events
  where firm_id = v_profile.firm_id
    and created_at >= v_day_start
    and (
      status = 'ok'
      or (
        status = 'reserved'
        and coalesce(lease_expires_at, created_at + interval '2 minutes') > v_now
      )
    );

  if v_used_today >= v_daily_quota then
    insert into crmpro.ai_usage_events (
      firm_id, user_id, feature, request_id, status, model_id, input_chars, latency_ms, lease_expires_at, created_at
    ) values (
      v_profile.firm_id, v_uid, p_feature, v_req_id, 'rate_limited', v_model, v_chars, null, null, v_now
    )
    on conflict (firm_id, request_id) do nothing;

    return jsonb_build_object(
      'allowed', false,
      'code', 'daily_quota_exceeded',
      'daily_quota', v_daily_quota,
      'used_today', v_used_today,
      'error', format('Daily AI quota reached (%s requests/day on your current plan). Try again tomorrow IST.', v_daily_quota)
    );
  end if;

  select count(*)::integer into v_burst_used
  from crmpro.ai_usage_events
  where firm_id = v_profile.firm_id
    and user_id = v_uid
    and created_at >= v_burst_cutoff
    and (
      status in ('ok', 'provider_error', 'validation_error', 'aborted')
      or (
        status = 'reserved'
        and coalesce(lease_expires_at, created_at + interval '2 minutes') > v_now
      )
    );

  if v_burst_used >= v_burst_limit then
    insert into crmpro.ai_usage_events (
      firm_id, user_id, feature, request_id, status, model_id, input_chars, latency_ms, lease_expires_at, created_at
    ) values (
      v_profile.firm_id, v_uid, p_feature, v_req_id, 'rate_limited', v_model, v_chars, null, null, v_now
    )
    on conflict (firm_id, request_id) do nothing;

    return jsonb_build_object(
      'allowed', false,
      'code', 'burst_limit_exceeded',
      'burst_limit', v_burst_limit,
      'burst_used', v_burst_used,
      'window_minutes', 10,
      'error', format('Rate limit reached (%s requests per 10 minutes). Wait a moment and retry.', v_burst_limit)
    );
  end if;

  insert into crmpro.ai_usage_events (
    firm_id, user_id, feature, request_id, status, model_id, input_chars, latency_ms, lease_expires_at, created_at
  ) values (
    v_profile.firm_id, v_uid, p_feature, v_req_id, 'reserved', v_model, v_chars, null, v_lease_expires_at, v_now
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'allowed', true,
    'code', 'reserved',
    'event_id', v_event_id,
    'lease_expires_at', v_lease_expires_at,
    'daily_quota', v_daily_quota,
    'used_today', v_used_today + 1,
    'burst_limit', v_burst_limit,
    'burst_used', v_burst_used + 1
  );
end;
$$;

-- Server-authorized finalization RPC (service_role ONLY).
-- Verifies firm/user ownership, serializes on the firm lock, and re-checks daily quota
-- before promoting an expired reservation or midnight rollover to 'ok'.
create or replace function crmpro.crmpro_finalize_ai_usage(
  p_event_id uuid,
  p_firm_id uuid,
  p_user_id uuid,
  p_status text,
  p_latency_ms integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = crmpro, public
as $$
declare
  v_now timestamptz := now();
  v_event crmpro.ai_usage_events%rowtype;
  v_firm crmpro.firms%rowtype;
  v_profile crmpro.profiles%rowtype;
  v_lease_expires_at timestamptz;
  v_current_day_start timestamptz;
  v_event_day_start timestamptz;
  v_daily_quota integer;
  v_used_current_day integer := 0;
  v_used_event_day integer := 0;
  v_effective_latency integer := case when p_latency_ms is null then null else greatest(0, p_latency_ms) end;
begin
  if current_user in ('authenticated', 'anon') then
    raise exception 'Service role required to finalize AI usage' using errcode = '42501';
  end if;

  if p_event_id is null or p_firm_id is null or p_user_id is null then
    raise exception 'Event, firm, and user IDs are required' using errcode = '22023';
  end if;

  if p_status is null or p_status not in ('ok', 'provider_error', 'validation_error', 'aborted') then
    raise exception 'Invalid terminal AI usage status' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('ai_quota:' || p_firm_id::text, 0));

  select * into v_profile
  from crmpro.profiles
  where id = p_user_id
    and firm_id = p_firm_id
    and role in ('owner', 'partner', 'staff');

  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'forbidden',
      'error', 'Caller profile is not an active writer in this firm.'
    );
  end if;

  select * into v_event
  from crmpro.ai_usage_events
  where id = p_event_id
    and firm_id = p_firm_id
    and user_id = p_user_id
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'not_found',
      'error', 'Reserved AI usage event was not found for this caller and firm.'
    );
  end if;

  if v_event.status <> 'reserved' then
    return jsonb_build_object(
      'ok', false,
      'code', 'already_finalized',
      'error', 'AI usage event has already been finalized.'
    );
  end if;

  v_lease_expires_at := coalesce(v_event.lease_expires_at, v_event.created_at + interval '2 minutes');

  if p_status = 'ok' then
    v_current_day_start := (date_trunc('day', v_now at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata');
    v_event_day_start := (date_trunc('day', v_event.created_at at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata');

    if v_now >= v_lease_expires_at or v_event_day_start < v_current_day_start then
      select * into v_firm
      from crmpro.firms
      where id = p_firm_id;

      if not found then
        return jsonb_build_object('ok', false, 'code', 'forbidden', 'error', 'Active firm record was not found.');
      end if;

      v_daily_quota := case
        when v_firm.subscription_status = 'trialing'
             and v_firm.trial_ends_at is not null
             and v_firm.trial_ends_at > v_now then 150
        when v_firm.subscription_status = 'cancelled' then 25
        when v_firm.plan = 'pro' then 500
        when v_firm.plan = 'growth' then 150
        else 25
      end;

      select count(*)::integer into v_used_current_day
      from crmpro.ai_usage_events
      where firm_id = p_firm_id
        and id <> v_event.id
        and created_at >= v_current_day_start
        and (
          status = 'ok'
          or (
            status = 'reserved'
            and coalesce(lease_expires_at, created_at + interval '2 minutes') > v_now
          )
        );

      if v_event_day_start < v_current_day_start then
        select count(*)::integer into v_used_event_day
        from crmpro.ai_usage_events
        where firm_id = p_firm_id
          and id <> v_event.id
          and created_at >= v_event_day_start
          and created_at < v_event_day_start + interval '1 day'
          and status = 'ok';
      end if;

      if v_used_current_day >= v_daily_quota or (v_event_day_start < v_current_day_start and v_used_event_day >= v_daily_quota) then
        update crmpro.ai_usage_events
        set status = 'aborted',
            latency_ms = v_effective_latency,
            lease_expires_at = null
        where id = v_event.id;

        return jsonb_build_object(
          'ok', false,
          'code', 'quota_exceeded_after_lease',
          'daily_quota', v_daily_quota,
          'used_today', greatest(v_used_current_day, v_used_event_day),
          'error', format('Daily AI quota (%s requests/day) filled before this slow request completed. Please retry tomorrow IST.', v_daily_quota)
        );
      end if;

      -- Attribute rollover completions to current IST day so today's counter reflects them.
      if v_event_day_start < v_current_day_start then
        update crmpro.ai_usage_events
        set status = 'ok',
            latency_ms = v_effective_latency,
            lease_expires_at = null,
            created_at = v_now
        where id = v_event.id;

        return jsonb_build_object('ok', true, 'status', 'ok');
      end if;
    end if;
  end if;

  update crmpro.ai_usage_events
  set status = p_status,
      latency_ms = v_effective_latency,
      lease_expires_at = null
  where id = v_event.id;

  return jsonb_build_object('ok', true, 'status', p_status);
end;
$$;

-- Binds idempotency keys to caller (user_id) and canonicalized payload_hash,
-- and rejects invalid, read-only, or cross-firm assignees explicitly.
create or replace function crmpro.crmpro_confirm_ai_tasks(
  p_idempotency_key text,
  p_related_type text default null,
  p_related_id uuid default null,
  p_tasks jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = crmpro, extensions, public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile crmpro.profiles%rowtype;
  v_key text := trim(coalesce(p_idempotency_key, ''));
  v_related_type text := nullif(trim(coalesce(p_related_type, '')), '');
  v_existing crmpro.ai_task_batches%rowtype;
  v_canonical_tasks jsonb;
  v_payload_hash text;
  v_task jsonb;
  v_title text;
  v_body text;
  v_due_raw text;
  v_due_at timestamptz;
  v_assignee_raw text;
  v_assignee_id uuid;
  v_owner_id uuid;
  v_activity_id uuid;
  v_created_ids uuid[] := array[]::uuid[];
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select * into v_profile
  from crmpro.profiles
  where id = v_uid;

  if not found or v_profile.role not in ('owner', 'partner', 'staff') then
    raise exception 'Active firm writer role required' using errcode = '42501';
  end if;

  if char_length(v_key) < 8 or char_length(v_key) > 128 then
    raise exception 'Idempotency key must be 8-128 characters' using errcode = '22023';
  end if;

  if (v_related_type is null) <> (p_related_id is null) then
    raise exception 'Both relatedType and relatedId must be provided together' using errcode = '22023';
  end if;

  if v_related_type is not null and v_related_type not in ('account', 'lead') then
    raise exception 'Unsupported related record type' using errcode = '22023';
  end if;

  if p_tasks is null or jsonb_typeof(p_tasks) <> 'array' or jsonb_array_length(p_tasks) < 1 or jsonb_array_length(p_tasks) > 25 then
    raise exception 'Provide between 1 and 25 tasks to confirm' using errcode = '22023';
  end if;

  if exists (select 1 from jsonb_array_elements(p_tasks) as elem where jsonb_typeof(elem) <> 'object') then
    raise exception 'Each task must be a JSON object' using errcode = '22023';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'title', trim(coalesce(elem ->> 'title', '')),
        'description', coalesce(trim(coalesce(elem ->> 'description', '')), ''),
        'assigneeId', nullif(lower(trim(coalesce(elem ->> 'assigneeId', ''))), ''),
        'dueDate', nullif(trim(coalesce(elem ->> 'dueDate', '')), '')
      )
    ),
    '[]'::jsonb
  )
  into v_canonical_tasks
  from jsonb_array_elements(p_tasks) as elem;

  v_payload_hash := encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'relatedType', v_related_type,
          'relatedId', p_related_id,
          'tasks', v_canonical_tasks
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  perform pg_advisory_xact_lock(
    hashtextextended('ai_task_batch:' || v_profile.firm_id::text || ':' || v_key, 0)
  );

  select * into v_existing
  from crmpro.ai_task_batches
  where firm_id = v_profile.firm_id
    and idempotency_key = v_key;

  if found then
    if v_existing.user_id <> v_uid then
      return jsonb_build_object(
        'ok', false,
        'code', 'idempotency_conflict',
        'error', 'This idempotency key belongs to another staff member.'
      );
    end if;
    if v_existing.related_type is distinct from v_related_type
       or v_existing.related_id is distinct from p_related_id
       or v_existing.payload_hash is distinct from v_payload_hash then
      return jsonb_build_object(
        'ok', false,
        'code', 'idempotency_conflict',
        'error', 'This idempotency key was already used with different task details.'
      );
    end if;
    return jsonb_build_object(
      'ok', true,
      'deduplicated', true,
      'created_ids', v_existing.created_activity_ids
    );
  end if;

  if v_related_type = 'account' then
    if not exists (
      select 1 from crmpro.accounts where id = p_related_id and firm_id = v_profile.firm_id
    ) then
      return jsonb_build_object(
        'ok', false,
        'code', 'not_found',
        'error', 'Related client or lead was not found in this firm.'
      );
    end if;
  elsif v_related_type = 'lead' then
    if not exists (
      select 1 from crmpro.leads where id = p_related_id and firm_id = v_profile.firm_id
    ) then
      return jsonb_build_object(
        'ok', false,
        'code', 'not_found',
        'error', 'Related client or lead was not found in this firm.'
      );
    end if;
  end if;

  for v_task in select value from jsonb_array_elements(p_tasks)
  loop
    v_title := trim(coalesce(v_task ->> 'title', ''));
    if char_length(v_title) < 1 or char_length(v_title) > 200 then
      raise exception 'Task title must be between 1 and 200 characters' using errcode = '22023';
    end if;

    v_body := nullif(trim(coalesce(v_task ->> 'description', '')), '');
    if v_body is not null and char_length(v_body) > 2000 then
      raise exception 'Task description must be 2000 characters or fewer' using errcode = '22023';
    end if;

    v_due_raw := nullif(trim(coalesce(v_task ->> 'dueDate', '')), '');
    if v_due_raw is not null then
      if v_due_raw !~ '^\d{4}-\d{2}-\d{2}$' then
        raise exception 'Due date must use YYYY-MM-DD format' using errcode = '22023';
      end if;
      v_due_at := ((v_due_raw || ' 18:00:00')::timestamp at time zone 'Asia/Kolkata');
    else
      v_due_at := null;
    end if;

    v_assignee_raw := nullif(trim(coalesce(v_task ->> 'assigneeId', '')), '');
    if v_assignee_raw is null then
      v_owner_id := v_uid;
    else
      if v_assignee_raw !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception 'Invalid assigneeId UUID format' using errcode = '22023';
      end if;
      v_assignee_id := v_assignee_raw::uuid;
      if not exists (
        select 1 from crmpro.profiles
        where id = v_assignee_id
          and firm_id = v_profile.firm_id
          and role in ('owner', 'partner', 'staff')
      ) then
        raise exception 'Task assignee must be an active writer in this firm' using errcode = '22023';
      end if;
      v_owner_id := v_assignee_id;
    end if;

    insert into crmpro.activities (
      firm_id,
      type,
      subject,
      body,
      due_at,
      related_type,
      related_id,
      owner_id
    ) values (
      v_profile.firm_id,
      'task',
      v_title,
      v_body,
      v_due_at,
      v_related_type,
      p_related_id,
      v_owner_id
    )
    returning id into v_activity_id;

    v_created_ids := array_append(v_created_ids, v_activity_id);
  end loop;

  insert into crmpro.ai_task_batches (
    firm_id,
    user_id,
    idempotency_key,
    related_type,
    related_id,
    created_activity_ids,
    payload_hash
  ) values (
    v_profile.firm_id,
    v_uid,
    v_key,
    v_related_type,
    p_related_id,
    to_jsonb(v_created_ids),
    v_payload_hash
  );

  return jsonb_build_object(
    'ok', true,
    'deduplicated', false,
    'created_ids', to_jsonb(v_created_ids)
  );
end;
$$;

revoke all on function crmpro.crmpro_reserve_ai_quota(text, text, text, integer) from public, anon;
grant execute on function crmpro.crmpro_reserve_ai_quota(text, text, text, integer) to authenticated, service_role;

revoke all on function crmpro.crmpro_finalize_ai_usage(uuid, uuid, uuid, text, integer) from public, anon, authenticated;
grant execute on function crmpro.crmpro_finalize_ai_usage(uuid, uuid, uuid, text, integer) to service_role;

revoke all on function crmpro.crmpro_confirm_ai_tasks(text, text, uuid, jsonb) from public, anon;
grant execute on function crmpro.crmpro_confirm_ai_tasks(text, text, uuid, jsonb) to authenticated, service_role;
