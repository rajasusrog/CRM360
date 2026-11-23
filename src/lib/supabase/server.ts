import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { CRM_SCHEMA, supabaseCookieOptions, type CrmDatabase } from "@/lib/supabase/options";
import { supabasePublicConfig } from "@/lib/supabase/public-env";

export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = supabasePublicConfig();
  return createServerClient<CrmDatabase, typeof CRM_SCHEMA>(
    process.env.SUPABASE_INTERNAL_URL || url,
    key,
    {
      db: { schema: CRM_SCHEMA },
      cookieOptions: supabaseCookieOptions,
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch (error) {
            // Server Components cannot set cookies. The proxy refreshes the session.
            // Next.js uses this error to opt a route out of static rendering; it must propagate.
            unstable_rethrow(error);
          }
        },
      },
    },
  );
}
