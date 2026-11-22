import { writeFileSync } from "node:fs";

// Workers Builds variables exist only during the build command. OpenNext
// copies .env files into the Worker and does not read process.env itself.
const keys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_APP_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_INTERNAL_URL",
];

const lines = [];
for (const key of keys) {
  const value = process.env[key];
  if (!value) continue;
  if (/[\r\n]/.test(value)) {
    console.error(`Refusing to write ${key}: the value contains a newline.`);
    process.exit(1);
  }
  lines.push(`${key}=${JSON.stringify(value)}`);
}

if (lines.length === 0) {
  console.warn(
    "No Supabase build variables found. /login and /signup need NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
  );
  process.exit(0);
}

writeFileSync(new URL("../.env.production", import.meta.url), `${lines.join("\n")}\n`);
const present = keys.filter((key) => process.env[key]);
console.log(`Wrote gitignored .env.production for OpenNext (${present.join(", ")}).`);
