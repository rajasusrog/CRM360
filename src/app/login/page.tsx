import { redirect } from "next/navigation";
import { AuthPanel } from "@/components/auth-panel";
import { getSession } from "@/lib/session";

export default async function LoginPage() {
  const session = await getSession();
  if (session.client) redirect("/portal");
  if (session.profile) redirect("/dashboard");
  return <AuthPanel mode="login" />;
}
