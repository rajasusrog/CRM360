import { redirect } from "next/navigation";
import { AuthPanel } from "@/components/auth-panel";
import { getSession } from "@/lib/session";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export default async function LoginPage() {
  if (!isSupabaseConfigured()) return <AuthPanel mode="login" unconfigured />;
  const session = await getSession();
  if (session.client) redirect("/portal");
  if (session.profile) redirect("/dashboard");
  return <AuthPanel mode="login" />;
}
