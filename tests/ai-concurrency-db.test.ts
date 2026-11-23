import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const databaseUrl = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

function psqlSync(sql: string): string {
  return execFileSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql], {
    encoding: "utf8",
  }).trim();
}

async function psqlAsync(sql: string): Promise<string> {
  const { stdout } = await execFileAsync(
    "psql",
    [databaseUrl, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql],
    { encoding: "utf8" },
  );
  return stdout.trim();
}

function asAuthenticatedSql(userId: string, bodySql: string): string {
  return `
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"${userId}","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '${userId}', true);
${bodySql}
commit;
`;
}

function asAnonSql(bodySql: string): string {
  return `
begin;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
${bodySql}
commit;
`;
}

function asServiceRoleSql(bodySql: string): string {
  return `
begin;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
${bodySql}
commit;
`;
}

const FIRM_STARTER = "cc000000-0000-4000-8000-0000000000a1";
const FIRM_GROWTH = "cc000000-0000-4000-8000-0000000000b1";
const USER_STARTER_STAFF = "cc000000-0000-4000-8000-0000000000a2";
const USER_STARTER_PARTNER = "cc000000-0000-4000-8000-0000000000a3";
const USER_STARTER_READONLY = "cc000000-0000-4000-8000-0000000000a4";
const USER_GROWTH_STAFF = "cc000000-0000-4000-8000-0000000000b2";
const ACCOUNT_STARTER = "cc000000-0000-4000-8000-0000000000c1";
const ACCOUNT_GROWTH = "cc000000-0000-4000-8000-0000000000c2";

const FINALIZE_SIGNATURE =
  "crmpro.crmpro_finalize_ai_usage(uuid, uuid, uuid, text, integer, integer, integer, integer)";

describe("AI Copilot PostgreSQL trust boundary, concurrency, late completion, and idempotency", () => {
  beforeAll(() => {
    psqlSync(`
begin;
delete from crmpro.firms where id in ('${FIRM_STARTER}', '${FIRM_GROWTH}');
delete from auth.users where id in (
  '${USER_STARTER_STAFF}',
  '${USER_STARTER_PARTNER}',
  '${USER_STARTER_READONLY}',
  '${USER_GROWTH_STAFF}'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000', '${USER_STARTER_STAFF}', 'authenticated', 'authenticated', 'starter-staff@concurrency.test', '', now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '${USER_STARTER_PARTNER}', 'authenticated', 'authenticated', 'starter-partner@concurrency.test', '', now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '${USER_STARTER_READONLY}', 'authenticated', 'authenticated', 'starter-readonly@concurrency.test', '', now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '${USER_GROWTH_STAFF}', 'authenticated', 'authenticated', 'growth-staff@concurrency.test', '', now(), '{}', '{}', now(), now(), '', '', '', '');

insert into crmpro.firms (id, name, plan, subscription_status) values
  ('${FIRM_STARTER}', 'Concurrent Starter Firm', 'starter', 'active'),
  ('${FIRM_GROWTH}', 'Concurrent Growth Firm', 'growth', 'active');

insert into crmpro.profiles (id, firm_id, full_name, email, role) values
  ('${USER_STARTER_STAFF}', '${FIRM_STARTER}', 'Starter Staff', 'starter-staff@concurrency.test', 'staff'),
  ('${USER_STARTER_PARTNER}', '${FIRM_STARTER}', 'Starter Partner', 'starter-partner@concurrency.test', 'partner'),
  ('${USER_STARTER_READONLY}', '${FIRM_STARTER}', 'Starter Readonly', 'starter-readonly@concurrency.test', 'readonly'),
  ('${USER_GROWTH_STAFF}', '${FIRM_GROWTH}', 'Growth Staff', 'growth-staff@concurrency.test', 'staff');

insert into crmpro.ai_firm_settings (firm_id, enabled, notice_accepted_at, notice_accepted_by) values
  ('${FIRM_STARTER}', true, now(), '${USER_STARTER_PARTNER}'),
  ('${FIRM_GROWTH}', true, now(), '${USER_GROWTH_STAFF}');

insert into crmpro.accounts (id, firm_id, name, entity_type) values
  ('${ACCOUNT_STARTER}', '${FIRM_STARTER}', 'Starter Client Co', 'proprietorship'),
  ('${ACCOUNT_GROWTH}', '${FIRM_GROWTH}', 'Growth Client Co', 'pvt_ltd');
commit;
`);
  });

  afterAll(() => {
    try {
      psqlSync(`
begin;
delete from crmpro.firms where id in ('${FIRM_STARTER}', '${FIRM_GROWTH}');
delete from auth.users where id in (
  '${USER_STARTER_STAFF}',
  '${USER_STARTER_PARTNER}',
  '${USER_STARTER_READONLY}',
  '${USER_GROWTH_STAFF}'
);
commit;
`);
    } catch {
      // Ignore cleanup failures if PostgreSQL is unreachable in this environment.
    }
  });

  it("blocks anon and authenticated finalization via EXECUTE grants and table write forgery, allowing only service_role", async () => {
    psqlSync(`delete from crmpro.ai_usage_events where firm_id = '${FIRM_STARTER}';`);

    // Verify PostgreSQL catalog EXECUTE privileges directly
    const privRow = psqlSync(`
      select json_build_object(
        'public_exec', has_function_privilege('public', '${FINALIZE_SIGNATURE}', 'execute'),
        'anon_exec', has_function_privilege('anon', '${FINALIZE_SIGNATURE}', 'execute'),
        'auth_exec', has_function_privilege('authenticated', '${FINALIZE_SIGNATURE}', 'execute'),
        'service_exec', has_function_privilege('service_role', '${FINALIZE_SIGNATURE}', 'execute')
      )::text;
    `);
    const privs = JSON.parse(privRow) as {
      public_exec: boolean;
      anon_exec: boolean;
      auth_exec: boolean;
      service_exec: boolean;
    };
    expect(privs).toEqual({
      public_exec: false,
      anon_exec: false,
      auth_exec: false,
      service_exec: true,
    });

    const reserveRaw = await psqlAsync(
      asAuthenticatedSql(
        USER_STARTER_STAFF,
        `select crmpro.crmpro_reserve_ai_quota('briefing', 'auth-boundary-req-1', 'gemini-4-hydrogen', 100)::text;`,
      ),
    );
    const reserve = JSON.parse(reserveRaw.split("\n").pop()!) as { allowed: boolean; event_id: string };
    expect(reserve.allowed).toBe(true);

    // Direct anonymous call to finalize RPC must fail with permission denied
    await expect(
      psqlAsync(
        asAnonSql(
          `select crmpro.crmpro_finalize_ai_usage('${reserve.event_id}'::uuid, '${FIRM_STARTER}'::uuid, '${USER_STARTER_STAFF}'::uuid, 'aborted', 5, 10, 5, 15)::text;`,
        ),
      ),
    ).rejects.toThrow(/permission denied/i);

    // Direct authenticated call to finalize RPC must fail with permission denied
    await expect(
      psqlAsync(
        asAuthenticatedSql(
          USER_STARTER_STAFF,
          `select crmpro.crmpro_finalize_ai_usage('${reserve.event_id}'::uuid, '${FIRM_STARTER}'::uuid, '${USER_STARTER_STAFF}'::uuid, 'aborted', 5, 10, 5, 15)::text;`,
        ),
      ),
    ).rejects.toThrow(/permission denied/i);

    // Legacy 3-arg and 5-arg signatures must not exist
    await expect(
      psqlAsync(
        asAuthenticatedSql(
          USER_STARTER_STAFF,
          `select crmpro.crmpro_finalize_ai_usage('${reserve.event_id}'::uuid, 'aborted', 5)::text;`,
        ),
      ),
    ).rejects.toThrow(/does not exist|permission denied/i);

    await expect(
      psqlAsync(
        asServiceRoleSql(
          `select crmpro.crmpro_finalize_ai_usage('${reserve.event_id}'::uuid, '${FIRM_STARTER}'::uuid, '${USER_STARTER_STAFF}'::uuid, 'ok', 100)::text;`,
        ),
      ),
    ).rejects.toThrow(/function crmpro\.crmpro_finalize_ai_usage.*does not exist|not unique/i);

    // Direct INSERT/UPDATE forgery into ai_usage_events and ai_task_batches must fail
    await expect(
      psqlAsync(
        asAuthenticatedSql(
          USER_STARTER_STAFF,
          `insert into crmpro.ai_usage_events (firm_id, user_id, feature, request_id, status, model_id, input_chars) values ('${FIRM_STARTER}', '${USER_STARTER_STAFF}', 'briefing', 'forged-1', 'ok', 'gemini-4-hydrogen', 1);`,
        ),
      ),
    ).rejects.toThrow(/permission denied/i);

    await expect(
      psqlAsync(
        asAuthenticatedSql(
          USER_STARTER_STAFF,
          `insert into crmpro.ai_task_batches (firm_id, user_id, idempotency_key, created_activity_ids, payload_hash) values ('${FIRM_STARTER}', '${USER_STARTER_STAFF}', 'forged-batch-1', '[]'::jsonb, 'abc');`,
        ),
      ),
    ).rejects.toThrow(/permission denied/i);

    // Service role with mismatched user_id cannot finalize another user's reservation
    const wrongUserRaw = await psqlAsync(
      asServiceRoleSql(
        `select crmpro.crmpro_finalize_ai_usage('${reserve.event_id}'::uuid, '${FIRM_STARTER}'::uuid, '${USER_STARTER_PARTNER}'::uuid, 'ok', 100, 120, 45, 165)::text;`,
      ),
    );
    const wrongUser = JSON.parse(wrongUserRaw.split("\n").pop()!) as { ok: boolean; code: string };
    expect(wrongUser.ok).toBe(false);
    expect(wrongUser.code).toBe("not_found");

    // Service role with matching firm and user succeeds and stores token usage
    const validFinRaw = await psqlAsync(
      asServiceRoleSql(
        `select crmpro.crmpro_finalize_ai_usage('${reserve.event_id}'::uuid, '${FIRM_STARTER}'::uuid, '${USER_STARTER_STAFF}'::uuid, 'ok', 180, 120, 45, 165)::text;`,
      ),
    );
    const validFin = JSON.parse(validFinRaw.split("\n").pop()!) as { ok: boolean; status: string };
    expect(validFin.ok).toBe(true);
    expect(validFin.status).toBe("ok");

    const tokensRow = psqlSync(
      `select json_build_object('p', prompt_tokens, 'c', completion_tokens, 't', total_tokens)::text from crmpro.ai_usage_events where id = '${reserve.event_id}';`,
    );
    expect(JSON.parse(tokensRow)).toEqual({ p: 120, c: 45, t: 165 });
  });

  it("prevents late completion after lease expiry from exceeding daily firm quota", async () => {
    psqlSync(`delete from crmpro.ai_usage_events where firm_id = '${FIRM_STARTER}';`);
    psqlSync(`
insert into crmpro.ai_usage_events (firm_id, user_id, feature, request_id, status, model_id, input_chars, created_at)
select
  '${FIRM_STARTER}',
  '${USER_STARTER_PARTNER}',
  'briefing',
  'seed-late-' || g,
  'ok',
  'gemini-4-hydrogen',
  100,
  now() - interval '1 hour'
from generate_series(1, 24) as g;
`);

    // Staff claims 25th slot, then its 2-minute lease expires
    const slowReserveRaw = await psqlAsync(
      asAuthenticatedSql(
        USER_STARTER_STAFF,
        `select crmpro.crmpro_reserve_ai_quota('briefing', 'slow-req-1', 'gemini-4-hydrogen', 100)::text;`,
      ),
    );
    const slowReserve = JSON.parse(slowReserveRaw.split("\n").pop()!) as { allowed: boolean; event_id: string };
    expect(slowReserve.allowed).toBe(true);

    psqlSync(
      `update crmpro.ai_usage_events set lease_expires_at = now() - interval '5 seconds' where id = '${slowReserve.event_id}';`,
    );

    // Partner claims the released 25th slot and completes it as 'ok'
    const fastReserveRaw = await psqlAsync(
      asAuthenticatedSql(
        USER_STARTER_PARTNER,
        `select crmpro.crmpro_reserve_ai_quota('briefing', 'fast-req-2', 'gemini-4-hydrogen', 100)::text;`,
      ),
    );
    const fastReserve = JSON.parse(fastReserveRaw.split("\n").pop()!) as { allowed: boolean; event_id: string };
    expect(fastReserve.allowed).toBe(true);

    const fastFinRaw = await psqlAsync(
      asServiceRoleSql(
        `select crmpro.crmpro_finalize_ai_usage('${fastReserve.event_id}'::uuid, '${FIRM_STARTER}'::uuid, '${USER_STARTER_PARTNER}'::uuid, 'ok', 90, 80, 20, 100)::text;`,
      ),
    );
    expect((JSON.parse(fastFinRaw.split("\n").pop()!) as { ok: boolean }).ok).toBe(true);

    // Slow request finishes late and tries to finalize as 'ok': must be rejected cleanly while recording aborted tokens
    const lateFinRaw = await psqlAsync(
      asServiceRoleSql(
        `select crmpro.crmpro_finalize_ai_usage('${slowReserve.event_id}'::uuid, '${FIRM_STARTER}'::uuid, '${USER_STARTER_STAFF}'::uuid, 'ok', 125000, 300, 100, 400)::text;`,
      ),
    );
    const lateFin = JSON.parse(lateFinRaw.split("\n").pop()!) as { ok: boolean; code: string };
    expect(lateFin.ok).toBe(false);
    expect(lateFin.code).toBe("quota_exceeded_after_lease");

    const okCount = Number(
      psqlSync(`select count(*) from crmpro.ai_usage_events where firm_id = '${FIRM_STARTER}' and status = 'ok';`),
    );
    expect(okCount).toBe(25);
    const abortedTokens = Number(
      psqlSync(`select total_tokens from crmpro.ai_usage_events where id = '${slowReserve.event_id}';`),
    );
    expect(abortedTokens).toBe(400);
  });

  it("enforces daily quota and 10-minute burst limit under concurrent parallel reservations", async () => {
    psqlSync(`delete from crmpro.ai_usage_events where firm_id = '${FIRM_STARTER}';`);
    psqlSync(`
insert into crmpro.ai_usage_events (firm_id, user_id, feature, request_id, status, model_id, input_chars, created_at)
select
  '${FIRM_STARTER}',
  '${USER_STARTER_PARTNER}',
  'briefing',
  'seed-ok-' || g,
  'ok',
  'gemini-4-hydrogen',
  120,
  now() - interval '1 hour'
from generate_series(1, 22) as g;
`);

    const dailyResults = await Promise.all(
      Array.from({ length: 8 }, (_, idx) =>
        psqlAsync(
          asAuthenticatedSql(
            USER_STARTER_STAFF,
            `select crmpro.crmpro_reserve_ai_quota('briefing', 'conc-daily-${idx}', 'gemini-4-hydrogen', 150)::text;`,
          ),
        ),
      ),
    );

    const dailyParsed = dailyResults.map((raw) => JSON.parse(raw.split("\n").pop()!) as { allowed: boolean; code: string });
    expect(dailyParsed.filter((r) => r.allowed && r.code === "reserved")).toHaveLength(3);
    expect(dailyParsed.filter((r) => !r.allowed && r.code === "daily_quota_exceeded")).toHaveLength(5);

    // Burst test on Growth firm with expired reservation row excluded by lease_expires_at
    psqlSync(`delete from crmpro.ai_usage_events where firm_id = '${FIRM_GROWTH}';`);
    psqlSync(`
insert into crmpro.ai_usage_events (firm_id, user_id, feature, request_id, status, model_id, input_chars, created_at)
select
  '${FIRM_GROWTH}',
  '${USER_GROWTH_STAFF}',
  'follow_up',
  'seed-burst-' || g,
  'ok',
  'gemini-4-hydrogen',
  100,
  now() - interval '1 minute'
from generate_series(1, 7) as g;

insert into crmpro.ai_usage_events (firm_id, user_id, feature, request_id, status, model_id, input_chars, lease_expires_at, created_at)
values (
  '${FIRM_GROWTH}',
  '${USER_GROWTH_STAFF}',
  'follow_up',
  'stale-reserved-1',
  'reserved',
  'gemini-4-hydrogen',
  100,
  now() - interval '15 seconds',
  now() - interval '2 minutes 15 seconds'
);
`);

    const burstResults = await Promise.all(
      Array.from({ length: 6 }, (_, idx) =>
        psqlAsync(
          asAuthenticatedSql(
            USER_GROWTH_STAFF,
            `select crmpro.crmpro_reserve_ai_quota('follow_up', 'conc-burst-${idx}', 'gemini-4-hydrogen', 100)::text;`,
          ),
        ),
      ),
    );
    const burstParsed = burstResults.map((raw) => JSON.parse(raw.split("\n").pop()!) as { allowed: boolean; code: string });
    expect(burstParsed.filter((r) => r.allowed && r.code === "reserved")).toHaveLength(3);
    expect(burstParsed.filter((r) => !r.allowed && r.code === "burst_limit_exceeded")).toHaveLength(3);

    // Read-only member is denied quota reservation
    const roRaw = await psqlAsync(
      asAuthenticatedSql(
        USER_STARTER_READONLY,
        `select crmpro.crmpro_reserve_ai_quota('briefing', 'ro-req-1', 'gemini-4-hydrogen', 100)::text;`,
      ),
    );
    expect((JSON.parse(roRaw.split("\n").pop()!) as { code: string }).code).toBe("forbidden");
  });

  it("deduplicates identical concurrent confirmations and rejects conflicting payloads, callers, and invalid assignees", async () => {
    psqlSync(`delete from crmpro.activities where firm_id = '${FIRM_STARTER}';`);
    psqlSync(`delete from crmpro.ai_task_batches where firm_id = '${FIRM_STARTER}';`);

    const key = "parallel-confirm-key-0001";
    const tasksJson = JSON.stringify([
      {
        title: "Collect GST 2B reconciliation",
        description: "Confirm October purchases with client",
        assigneeId: USER_STARTER_PARTNER,
        dueDate: "2026-11-28",
      },
    ]);

    const outputs = await Promise.all(
      Array.from({ length: 8 }, () =>
        psqlAsync(
          asAuthenticatedSql(
            USER_STARTER_STAFF,
            `select crmpro.crmpro_confirm_ai_tasks('${key}', 'account', '${ACCOUNT_STARTER}', '${tasksJson}'::jsonb)::text;`,
          ),
        ),
      ),
    );

    const parsed = outputs.map((raw) => JSON.parse(raw.split("\n").pop()!) as { ok: boolean; deduplicated: boolean; created_ids: string[] });
    expect(parsed.every((row) => row.ok)).toBe(true);
    expect(parsed.filter((row) => !row.deduplicated)).toHaveLength(1);
    expect(parsed.filter((row) => row.deduplicated)).toHaveLength(7);
    const firstIds = parsed[0].created_ids;
    for (const row of parsed) {
      expect(row.created_ids).toEqual(firstIds);
    }

    // Reusing the same idempotency key with DIFFERENT task content must return conflict
    const modifiedTasksJson = JSON.stringify([
      {
        title: "Tampered different title",
        description: "Confirm October purchases with client",
        assigneeId: USER_STARTER_PARTNER,
        dueDate: "2026-11-28",
      },
    ]);
    const mismatchRaw = await psqlAsync(
      asAuthenticatedSql(
        USER_STARTER_STAFF,
        `select crmpro.crmpro_confirm_ai_tasks('${key}', 'account', '${ACCOUNT_STARTER}', '${modifiedTasksJson}'::jsonb)::text;`,
      ),
    );
    const mismatch = JSON.parse(mismatchRaw.split("\n").pop()!) as { ok: boolean; code: string };
    expect(mismatch.ok).toBe(false);
    expect(mismatch.code).toBe("idempotency_conflict");

    // Another staff user reusing the same idempotency key with identical payload must also conflict
    const wrongCallerRaw = await psqlAsync(
      asAuthenticatedSql(
        USER_STARTER_PARTNER,
        `select crmpro.crmpro_confirm_ai_tasks('${key}', 'account', '${ACCOUNT_STARTER}', '${tasksJson}'::jsonb)::text;`,
      ),
    );
    const wrongCaller = JSON.parse(wrongCallerRaw.split("\n").pop()!) as { ok: boolean; code: string };
    expect(wrongCaller.ok).toBe(false);
    expect(wrongCaller.code).toBe("idempotency_conflict");

    // Cross-firm assignee in second task must throw and roll back first valid task
    const crossFirmAssigneeBatch = JSON.stringify([
      { title: "Valid rollback probe", description: "", assigneeId: USER_STARTER_PARTNER, dueDate: "2026-11-28" },
      { title: "Cross firm assignee", description: "", assigneeId: USER_GROWTH_STAFF, dueDate: "2026-11-28" },
    ]);
    await expect(
      psqlAsync(
        asAuthenticatedSql(
          USER_STARTER_STAFF,
          `select crmpro.crmpro_confirm_ai_tasks('bad-assignee-key-1', 'account', '${ACCOUNT_STARTER}', '${crossFirmAssigneeBatch}'::jsonb)::text;`,
        ),
      ),
    ).rejects.toThrow(/active writer in this firm/i);

    // Readonly assignee must also be explicitly rejected
    const readonlyAssigneeBatch = JSON.stringify([
      { title: "Readonly assignee test", description: "", assigneeId: USER_STARTER_READONLY, dueDate: "2026-11-28" },
    ]);
    await expect(
      psqlAsync(
        asAuthenticatedSql(
          USER_STARTER_STAFF,
          `select crmpro.crmpro_confirm_ai_tasks('bad-assignee-key-2', 'account', '${ACCOUNT_STARTER}', '${readonlyAssigneeBatch}'::jsonb)::text;`,
        ),
      ),
    ).rejects.toThrow(/active writer in this firm/i);

    // Activity count remains strictly 1 from the initial deduplicated batch
    const finalActivityCount = Number(
      psqlSync(`select count(*) from crmpro.activities where firm_id = '${FIRM_STARTER}';`),
    );
    expect(finalActivityCount).toBe(1);
  });
});
