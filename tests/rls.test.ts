import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const databaseUrl = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

function psql(sql: string): string {
  return execFileSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql], {
    encoding: "utf8",
  });
}

const userA = "aa000000-0000-4000-8000-0000000000aa";
const userB = "bb000000-0000-4000-8000-0000000000bb";
const firmA = "aa000000-0000-4000-8000-0000000000a1";
const firmB = "bb000000-0000-4000-8000-0000000000b1";

const setup = `
begin;
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000', '${userA}', 'authenticated', 'authenticated', 'a-rls@example.test', '', now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '${userB}', 'authenticated', 'authenticated', 'b-rls@example.test', '', now(), '{}', '{}', now(), now(), '', '', '', '');
insert into crmpro.firms (id, name) values ('${firmA}', 'Firm A'), ('${firmB}', 'Firm B');
insert into crmpro.profiles (id, firm_id, full_name, email, role) values
  ('${userA}', '${firmA}', 'Owner A', 'a-rls@example.test', 'owner'),
  ('${userB}', '${firmB}', 'Staff B', 'b-rls@example.test', 'staff');
insert into crmpro.leads (firm_id, first_name) values ('${firmA}', 'Only A'), ('${firmB}', 'Only B');
insert into crmpro.accounts (firm_id, name, entity_type) values ('${firmB}', 'Secret Co', 'individual');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"${userA}","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '${userA}', true);
`;

describe("row level security", () => {
  it("lets firm A read only its own leads and hides firm B", () => {
    const output = psql(`
      ${setup}
      select count(*) from crmpro.leads;
      select count(*) from crmpro.leads where first_name = 'Only B';
      select count(*) from crmpro.accounts where name = 'Secret Co';
      rollback;
    `);
    const counts = output
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^\d+$/.test(line));
    expect(counts.slice(-3)).toEqual(["1", "0", "0"]);
  });

  it("rejects a write into another firm's table", () => {
    expect(() =>
      psql(`
        ${setup}
        insert into crmpro.leads (firm_id, first_name) values ('${firmB}', 'Sneak');
        rollback;
      `),
    ).toThrow(/row-level security policy/);
  });
});
