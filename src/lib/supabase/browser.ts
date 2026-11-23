import { createBrowserClient } from "@supabase/ssr";
import { supabaseCookieOptions } from "@/lib/supabase/options";
import { supabasePublicConfig } from "@/lib/supabase/public-env";

export function createBrowserSupabase() {
  const { url, key } = supabasePublicConfig();
  return createBrowserClient(url, key, { db: { schema: "crmpro" }, cookieOptions: supabaseCookieOptions });
}
