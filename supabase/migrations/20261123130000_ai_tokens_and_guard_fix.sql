-- Additive migration: track provider attempt token usage on crmpro.ai_usage_events,
-- replace crmpro_finalize_ai_usage to remove the ineffective SECURITY DEFINER current_user check,
-- and enforce strict call-time EXECUTE grants restricted solely to service_role.

alter table crmpro.ai_usage_events
  add column if not exists prompt_tokens integer check (prompt_tokens is null or prompt_tokens >= 0),
  add column if not exists completion_tokens integer check (completion_tokens is null or completion_tokens >= 0),
  add column if not exists total_tokens integer check (total_tokens is null or total_tokens >= 0);

drop function if exists crmpro.crmpro_finalize_ai_usage(uuid, uuid, uuid, text, integer);

create or replace function crmpro.crmpro_finalize_ai_usage(
  p_event_id uuid,
  p_firm_id uuid,
  p_user_id uuid,
  p_status text,
  p_latency_ms integer default null,
  p_prompt_tokens integer default null,
  p_completion_tokens integer default null,
  p_total_tokens integer default null
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
  v_prompt_tokens integer := case when p_prompt_tokens is null then null else greatest(0, p_prompt_tokens) end;
  v_completion_tokens integer := case when p_completion_tokens is null then null else greatest(0, p_completion_tokens) end;
  v_total_tokens integer := case
    when p_total_tokens is not null then greatest(0, p_total_tokens)
    when p_prompt_tokens is not null and p_completion_tokens is not null then greatest(0, p_prompt_tokens) + greatest(0, p_completion_tokens)
    else null
  end;
begin
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
            prompt_tokens = v_prompt_tokens,
            completion_tokens = v_completion_tokens,
            total_tokens = v_total_tokens,
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

      if v_event_day_start < v_current_day_start then
        update crmpro.ai_usage_events
        set status = 'ok',
            latency_ms = v_effective_latency,
            prompt_tokens = v_prompt_tokens,
            completion_tokens = v_completion_tokens,
            total_tokens = v_total_tokens,
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
      prompt_tokens = v_prompt_tokens,
      completion_tokens = v_completion_tokens,
      total_tokens = v_total_tokens,
      lease_expires_at = null
  where id = v_event.id;

  return jsonb_build_object('ok', true, 'status', p_status);
end;
$$;

revoke all on function crmpro.crmpro_finalize_ai_usage(uuid, uuid, uuid, text, integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function crmpro.crmpro_finalize_ai_usage(uuid, uuid, uuid, text, integer, integer, integer, integer) to service_role;
