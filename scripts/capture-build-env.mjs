import { writeFileSync } from "node:fs";

// Workers Builds variables exist only during the build command. OpenNext
// copies .env files into the Worker and does not read process.env itself.
function first(names) {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return "";
}

// The Worker stores these as SUPABASE_URL / SUPABASE_ANON_KEY (and the Vite names).
// Next only inlines NEXT_PUBLIC_* into the browser bundle, so copy them across.
const values = {
  NEXT_PUBLIC_SUPABASE_URL: first(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL", "VITE_SUPABASE_URL"]),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: first(["NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY"]),
  NEXT_PUBLIC_APP_URL:
    first(["NEXT_PUBLIC_APP_URL"]) ||
    (first(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL", "VITE_SUPABASE_URL", "WORKERS_CI", "CF_PAGES"])
      ? "https://crm360.unikorn360.com"
      : ""),
  NEXT_PUBLIC_DEMO_MODE: first(["NEXT_PUBLIC_DEMO_MODE"]),
  SUPABASE_SERVICE_ROLE_KEY: first(["SUPABASE_SERVICE_ROLE_KEY"]),
  SUPABASE_INTERNAL_URL: first(["SUPABASE_INTERNAL_URL"]),
};

const lines = [];
for (const [key, value] of Object.entries(values)) {
  if (!value) continue;
  if (/[\r\n]/.test(value)) {
    console.error(`Refusing to write ${key}: the value contains a newline.`);
    process.exit(1);
  }
  lines.push(`${key}=${JSON.stringify(value)}`);
}

if (lines.length === 0) {
  console.warn(
    "No Supabase build variables found. Set SUPABASE_URL and SUPABASE_ANON_KEY, or NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
  );
  process.exit(0);
}

writeFileSync(new URL("../.env.production", import.meta.url), `${lines.join("\n")}\n`);
const present = Object.entries(values)
  .filter(([, value]) => value)
  .map(([key]) => key);
console.log(`Wrote gitignored .env.production for OpenNext (${present.join(", ")}).`);
