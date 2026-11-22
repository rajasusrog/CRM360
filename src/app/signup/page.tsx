import { redirect } from "next/navigation";
import { AuthPanel } from "@/components/auth-panel";
import { getSession } from "@/lib/session";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export default async function SignupPage() {
  if (!isSupabaseConfigured()) return <AuthPanel mode="signup" unconfigured />;
  const session = await getSession();
  if (session.profile) redirect("/dashboard");
  if (session.client) redirect("/portal");
  if (session.user) redirect("/onboarding");
  return <AuthPanel mode="signup" />;
}
