import { cookies } from "next/headers";
import { Shell } from "@/components/shell";
import { isLocale } from "@/lib/i18n";
import { requireStaff } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStaff();
  const jar = await cookies();
  const raw = jar.get("locale")?.value;
  const locale = isLocale(raw) ? raw : "en";
  const { count } = await session.supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", session.profile.id)
    .is("read_at", null);

  return (
    <Shell locale={locale} firmName={session.firm.name} userName={session.profile.full_name} role={session.profile.role} unread={count ?? 0}>
      {children}
    </Shell>
  );
}
