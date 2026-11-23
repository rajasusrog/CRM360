import Link from "next/link";
import { PLANS } from "@/lib/plans";
import { formatInr } from "@/lib/format";
import { brand } from "@/lib/brand";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Link href="/" className="flex items-center gap-3">
          <img src="/brand/logo.jpg" alt="" className="size-12 rounded-md object-cover object-[center_18%]" />
          <span>
            <span className="block font-display text-xl leading-none tracking-wide">UNIKORN360</span>
            <span className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">{brand.line}</span>
          </span>
        </Link>
        <div className="flex items-center gap-2 text-sm">
          <a href={brand.website} className="hidden rounded-lg px-3 py-2 hover:bg-muted sm:inline">
            {brand.websiteLabel}
          </a>
          <Link href="/login" className="rounded-lg px-3 py-2 hover:bg-muted">
            Sign in
          </Link>
          <Link href="/signup" className="rounded-lg bg-primary px-3 py-2 text-primary-foreground">
            Open a firm
          </Link>
        </div>
      </header>

      <div className="border-y border-[var(--accent)] bg-card">
        <img src="/brand/banner.jpg" alt="Unikorn360 CRM. Manage leads. Build relationships." className="mx-auto max-h-[28rem] w-full max-w-6xl object-contain" />
      </div>

      <main className="mx-auto max-w-6xl px-5 pb-16">
        <section className="grid items-end gap-10 py-12 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">{brand.line}</p>
            <h1 className="mt-3 max-w-xl font-display text-5xl leading-[1.05] tracking-tight text-primary sm:text-6xl">
              {brand.headline}
            </h1>
            <p className="mt-5 max-w-lg text-lg text-muted-foreground">
              The practice desk for Tamil Nadu CA and GST firms. Leads, clients, a filing calendar, and tax invoices, from the same house that builds software, automation, and finance advisory.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/signup" className="rounded-lg bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                Start the 14-day trial
              </Link>
              <Link href="/login" className="rounded-lg border border-primary/30 px-4 py-2.5 text-sm">
                View the demo firm
              </Link>
            </div>
          </div>
          <aside className="overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10">
            <img src="/brand/logo.jpg" alt="Unikorn360 logo" className="w-full object-cover" />
          </aside>
        </section>

        <section>
          <h2 className="font-display text-3xl text-primary">What the CRM covers</h2>
          <div className="mt-2 h-0.5 w-16 bg-[var(--accent)]" />
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {brand.offerings.map((item) => (
              <li key={item} className="rounded-xl bg-card px-4 py-5 text-sm ring-1 ring-foreground/10">
                <span className="mb-3 block h-0.5 w-8 bg-[var(--accent)]" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="grid gap-6 py-12 md:grid-cols-3">
          {[
            ["Pipeline", "Leads, contacts, and a drag-and-drop deal board for a 2 to 15 person desk."],
            ["Compliance calendar", "GSTR-1, GSTR-3B, TDS, advance tax, ITR, and ROC dates you can change when a notification moves them."],
            ["GST invoices", "18% split into CGST and SGST or IGST from the place of supply, with SAC codes and a PDF."],
          ].map(([title, body]) => (
            <article key={title} className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
              <h2 className="font-display text-2xl text-primary">{title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </article>
          ))}
        </section>

        <section className="py-12">
          <h2 className="font-display text-3xl text-primary">Plans, in rupees</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Flat monthly firm pricing — all seats included, not billed per user. Trial includes Growth for 14 days.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {Object.values(PLANS).map((plan) => {
              const perSeat = plan.priceInr === 0 ? 0 : Math.round(plan.priceInr / plan.seats);
              return (
                <article key={plan.id} className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
                  <h3 className="font-display text-2xl text-primary">{plan.name}</h3>
                  <p className="mt-2 font-display text-4xl">
                    {plan.priceInr === 0 ? "Free" : formatInr(plan.priceInr, 0)}
                    <span className="text-base text-muted-foreground">
                      {plan.priceInr === 0 ? " forever" : " / month flat"}
                    </span>
                  </p>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">
                    {plan.priceInr === 0
                      ? `Up to ${plan.seats} seats · ₹0/seat`
                      : `Up to ${plan.seats} seats included (~${formatInr(perSeat, 0)}/seat)`}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
                  <ul className="mt-4 space-y-1 text-sm">
                    <li>{plan.seats} seats included</li>
                    <li>{plan.clients.toLocaleString("en-IN")} clients</li>
                    <li>Compliance calendar &amp; GST invoices</li>
                    <li>{plan.workflows ? "Workflows & custom fields" : "Core pipeline & tasks"}</li>
                    <li>{plan.portal ? "Client portal & upload links" : "No client portal"}</li>
                  </ul>
                </article>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--accent)] bg-sidebar text-sidebar-foreground">
        <div className="mx-auto max-w-6xl px-5 py-10">
          <div className="text-sm leading-relaxed">
            <p className="font-display text-2xl text-sidebar-primary">{brand.founder}</p>
            <p>{brand.role}</p>
            <p className="mt-4"><a href={`tel:${brand.phoneTel}`}>{brand.phone}</a></p>
            <p><a href={`mailto:${brand.email}`}>{brand.email}</a></p>
            <p><a href={brand.website}>{brand.websiteLabel}</a></p>
            <address className="mt-4 not-italic text-sidebar-foreground/80">
              {brand.addressLines.map((line) => (
                <span key={line} className="block">{line}</span>
              ))}
            </address>
            <p className="mt-6 text-xs tracking-[0.14em] text-sidebar-primary uppercase">{brand.tagline}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
