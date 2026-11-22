import { redirect } from "next/navigation";
import { AuthPanel } from "@/components/auth-panel";
import { getSession } from "@/lib/session";

export default async function SignupPage() {
  const session = await getSession();
  if (session.profile) redirect("/dashboard");
  if (session.client) redirect("/portal");
  if (session.user) redirect("/onboarding");
  return <AuthPanel mode="signup" />;
}
