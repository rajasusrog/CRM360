"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell,
  CalendarDays,
  Clock3,
  Contact,
  FileSpreadsheet,
  LayoutDashboard,
  Menu,
  Receipt,
  Scale,
  Search,
  Settings,
  SquareKanban,
  Users,
  Building2,
  ListChecks,
} from "lucide-react";
import { translate, type Locale } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/en";
import { signOut, setLocale } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "cn";

const links: Array<{ href: string; key: MessageKey; icon: typeof LayoutDashboard }> = [
  { href: "/dashboard", key: "nav.dashboard", icon: LayoutDashboard },
  { href: "/leads", key: "nav.leads", icon: Users },
  { href: "/contacts", key: "nav.contacts", icon: Contact },
  { href: "/clients", key: "nav.clients", icon: Building2 },
  { href: "/deals", key: "nav.pipeline", icon: SquareKanban },
  { href: "/activities", key: "nav.activities", icon: ListChecks },
  { href: "/calendar", key: "nav.calendar", icon: CalendarDays },
  { href: "/compliance", key: "nav.compliance", icon: Scale },
  { href: "/invoices", key: "nav.invoices", icon: Receipt },
  { href: "/time", key: "nav.time", icon: Clock3 },
  { href: "/reports", key: "nav.reports", icon: FileSpreadsheet },
  { href: "/settings", key: "nav.settings", icon: Settings },
];

function NavLinks({ locale, onNavigate }: { locale: Locale; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="grid gap-0.5">
      {links.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              active && "bg-sidebar-accent text-sidebar-accent-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {translate(locale, link.key)}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 px-2">
      <img src="/brand/logo.jpg" alt="" className="size-11 rounded-md object-cover object-[center_18%]" />
      <span>
        <span className="block font-display text-lg leading-none tracking-wide text-sidebar-foreground">UNIKORN360</span>
        <span className="text-[10px] tracking-[0.14em] text-sidebar-primary uppercase">CRM</span>
      </span>
    </Link>
  );
}

export function Shell({
  locale,
  firmName,
  userName,
  role,
  unread,
  children,
}: {
  locale: Locale;
  firmName: string;
  userName: string;
  role: string;
  unread: number;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="hidden bg-sidebar text-sidebar-foreground lg:flex lg:flex-col lg:gap-6 lg:px-3 lg:py-5">
        <Brand />
        <NavLinks locale={locale} />
        <div className="mt-auto px-2 text-[11px] leading-relaxed text-sidebar-foreground/70">
          <p className="text-sidebar-foreground">{firmName}</p>
          <p className="mt-2 text-sidebar-primary">www.unikorn360.com</p>
          <p>VK Complex, P.J.N. Road, Vaniyambadi, Tamil Nadu 635751</p>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-background/90 px-3 py-2 backdrop-blur md:px-6">
          <MobileNav locale={locale} />
          <SearchBox />
          <div className="ml-auto flex items-center gap-2">
            <Link href="/notifications" className="relative rounded-lg p-2 hover:bg-muted" aria-label={translate(locale, "nav.notifications")}>
              <Bell className="size-4" />
              {unread > 0 ? <span className="absolute top-1 right-1 size-2 rounded-full bg-destructive" /> : null}
            </Link>
            <form action={setLocale.bind(null, locale === "en" ? "ta" : "en")}>
              <Button type="submit" variant="ghost" size="sm">
                {locale === "en" ? "தமிழ்" : "English"}
              </Button>
            </form>
            <div className="hidden text-right sm:block">
              <p className="text-sm leading-none">{userName}</p>
              <p className="text-[11px] text-muted-foreground capitalize">{role}</p>
            </div>
            <form action={signOut}>
              <Button type="submit" variant="outline" size="sm">
                {translate(locale, "action.signOut")}
              </Button>
            </form>
          </div>
        </header>
        <main className="px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}

function MobileNav({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="rounded-lg p-2 hover:bg-muted lg:hidden" aria-label="Open menu">
        <Menu className="size-4" />
      </SheetTrigger>
      <SheetContent side="left" className="bg-sidebar text-sidebar-foreground">
        <div className="mt-8 grid gap-6">
          <Brand />
          <NavLinks locale={locale} onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SearchBox() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ href: string; label: string; kind: string }>>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) return;
      setResults(await response.json());
      setOpen(true);
    }, 200);
    return () => clearTimeout(handle);
  }, [query]);

  return (
    <div className="relative min-w-0 flex-1 max-w-md">
      <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => results.length && setOpen(true)}
        placeholder="Search clients, leads, invoices"
        className="h-9 w-full rounded-lg border border-input bg-card pr-3 pl-8 text-sm outline-none focus:border-ring"
      />
      {open && results.length > 0 ? (
        <div className="absolute z-40 mt-1 w-full rounded-lg bg-popover p-1 shadow-lg ring-1 ring-foreground/10">
          {results.map((result) => (
            <Link
              key={result.href + result.label}
              href={result.href}
              onClick={() => {
                setOpen(false);
                setQuery("");
              }}
              className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted"
            >
              <span>{result.label}</span>
              <span className="text-xs text-muted-foreground">{result.kind}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
