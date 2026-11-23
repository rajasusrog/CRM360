import "server-only";
import { createClient } from "@supabase/supabase-js";
import { CRM_SCHEMA, type CrmDatabase } from "@/lib/supabase/options";

export function createAdmin() {
  const url = process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase service role is not configured.");
  }
  return createClient<CrmDatabase, typeof CRM_SCHEMA>(url, key, {
    db: { schema: CRM_SCHEMA },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
