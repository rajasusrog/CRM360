import Link from "next/link";
import { translate, isLocale, type Locale } from "@/lib/i18n";
import { requireClient } from "@/lib/session";
import { cookies } from "next/headers";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await requireClient();
  const jar = await cookies();
  const raw = jar.get("locale")?.value;
  const locale: Locale = isLocale(raw) ? raw : "en";

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center gap-4 border-b border-border px-5 py-4">
        <Link href="/portal" className="flex items-center gap-2">
          <img src="/brand/logo.jpg" alt="" className="size-9 rounded-md object-cover object-[center_18%]" />
          <span className="font-display text-xl tracking-wide">UNIKORN360</span>
        </Link>
        <nav className="flex gap-4 text-sm">
          <Link href="/portal">{translate(locale, "portal.home")}</Link>
          <Link href="/portal/filings">{translate(locale, "portal.filings")}</Link>
          <Link href="/portal/invoices">{translate(locale, "portal.invoices")}</Link>
          <Link href="/portal/documents">{translate(locale, "portal.documents")}</Link>
        </nav>
        <p className="ml-auto text-sm text-muted-foreground">{session.firm.name}</p>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-8">{children}</main>
    </div>
  );
}
