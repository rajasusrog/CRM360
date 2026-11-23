"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import type { GroundedBriefing, GroundedFact } from "@/lib/ai/grounding";
import { AiFeedbackBar } from "@/components/ai/ai-feedback-bar";
import { Button } from "@/components/ui/button";

type BriefingPayload = {
  requestId: string;
  model: string;
  accountName: string;
  briefing: GroundedBriefing;
};

function FactList({ title, items }: { title: string; items: GroundedFact[] }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
      <ul className="space-y-2 text-sm">
        {items.map((item, idx) => (
          <li key={`${title}-${idx}`} className="rounded-lg border border-border bg-background/60 p-2.5">
            <p className="text-foreground">{item.text}</p>
            {item.sources.length > 0 ? (
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>Sources:</span>
                {item.sources.map((src) => (
                  <Link key={src.key} href={src.href} className="text-primary underline underline-offset-2 hover:opacity-80">
                    {src.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CustomerBriefingPanel({
  accountId,
  accountName,
  aiEnabled,
  canUseAi,
}: {
  accountId: string;
  accountName: string;
  aiEnabled: boolean;
  canUseAi: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BriefingPayload | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function runBriefing() {
    if (loading) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
        signal: controller.signal,
      });
      const json = (await response.json().catch(() => null)) as (BriefingPayload & { error?: string }) | null;
      if (!response.ok || !json?.briefing) {
        setError(json?.error ?? "Could not generate briefing.");
        return;
      }
      setData(json);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("Briefing generation cancelled.");
      } else {
        setError("Network error while contacting AI Copilot.");
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  function cancelBriefing() {
    abortRef.current?.abort();
  }

  const b = data?.briefing;
  const hasAnySection =
    Boolean(b?.overview) ||
    (b?.recentActivity.length ?? 0) > 0 ||
    (b?.openDeals.length ?? 0) > 0 ||
    (b?.outstandingCommitments.length ?? 0) > 0 ||
    (b?.suggestedNextActions.length ?? 0) > 0 ||
    (b?.missingInformation.length ?? 0) > 0;

  return (
    <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl">AI Briefing</h2>
          <p className="text-xs text-muted-foreground">
            Grounded snapshot of {accountName} with cited CRM records, separated from suggested actions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {loading ? (
            <Button type="button" variant="outline" size="sm" onClick={cancelBriefing} className="whitespace-nowrap shrink-0">
              <X className="size-3.5" />
              Cancel
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            disabled={!aiEnabled || !canUseAi || loading}
            onClick={runBriefing}
            className="whitespace-nowrap shrink-0"
          >
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : data ? <RefreshCw className="size-3.5" /> : <Sparkles className="size-3.5" />}
            {loading ? "Generating…" : data ? "Refresh briefing" : "AI Briefing"}
          </Button>
        </div>
      </div>

      {!aiEnabled ? (
        <p className="mt-3 text-sm text-muted-foreground">
          AI Copilot is currently off for this firm. An owner or partner can enable it in{" "}
          <Link href="/settings" className="underline">
            Settings
          </Link>
          .
        </p>
      ) : !canUseAi ? (
        <p className="mt-3 text-sm text-muted-foreground">Read-only users cannot run AI Copilot actions.</p>
      ) : null}

      {error ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <span>{error}</span>
          <Button type="button" variant="outline" size="sm" onClick={runBriefing}>
            Retry
          </Button>
        </div>
      ) : null}

      {b && !hasAnySection ? (
        <p className="mt-3 text-sm text-muted-foreground">Not enough CRM records exist for this client yet to build a briefing.</p>
      ) : null}

      {b && hasAnySection ? (
        <div className="mt-4 grid gap-4">
          {b.overview ? (
            <div className="space-y-2 rounded-lg border border-border bg-background/50 p-3">
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Recorded overview</h3>
              {b.overview.summary ? <p className="text-sm text-foreground">{b.overview.summary}</p> : null}
              {b.overview.facts.length > 0 ? (
                <ul className="space-y-1.5 text-sm">
                  {b.overview.facts.map((fact, idx) => (
                    <li key={`ov-${idx}`} className="text-foreground">
                      <span>{fact.text}</span>
                      {fact.sources.length > 0 ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          (
                          {fact.sources.map((src, sIdx) => (
                            <span key={src.key}>
                              {sIdx > 0 ? ", " : ""}
                              <Link href={src.href} className="underline">
                                {src.label}
                              </Link>
                            </span>
                          ))}
                          )
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <FactList title="Recent relevant activity" items={b.recentActivity} />
            <FactList title="Open enquiries and deals" items={b.openDeals} />
          </div>

          <FactList title="Outstanding commitments" items={b.outstandingCommitments} />

          {b.suggestedNextActions.length > 0 ? (
            <div className="space-y-2 border-t border-border pt-3">
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Suggested next actions (AI recommendations)
              </h3>
              <ul className="space-y-2 text-sm">
                {b.suggestedNextActions.map((item, idx) => (
                  <li key={`next-${idx}`} className="rounded-lg border border-border p-2.5">
                    <p className="font-medium text-foreground">{item.action}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.rationale}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {b.missingInformation.length > 0 ? (
            <div className="space-y-1.5 border-t border-border pt-3">
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Missing information
              </h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {b.missingInformation.map((gap, idx) => (
                  <li key={`gap-${idx}`}>{gap}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {data ? <AiFeedbackBar feature="briefing" requestId={data.requestId} /> : null}
        </div>
      ) : null}
    </section>
  );
}
