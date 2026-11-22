import { createClient } from "@supabase/supabase-js";

export function createAdmin() {
  const url = process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase service role is not configured.");
  }
  return createClient(url, key, {
    db: { schema: "crmpro" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
