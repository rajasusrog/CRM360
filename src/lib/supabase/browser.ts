import { createBrowserClient } from "@supabase/ssr";
import { CRM_SCHEMA, supabaseCookieOptions, type CrmDatabase } from "@/lib/supabase/options";
import { supabasePublicConfig } from "@/lib/supabase/public-env";

export function createBrowserSupabase() {
  const { url, key } = supabasePublicConfig();
  return createBrowserClient<CrmDatabase, typeof CRM_SCHEMA>(url, key, {
    db: { schema: CRM_SCHEMA },
    cookieOptions: supabaseCookieOptions,
    isSingleton: true,
    auth: {
      flowType: "pkce",
      detectSessionInUrl: false,
      persistSession: true,
    },
  });
}
