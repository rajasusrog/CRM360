"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Check, Copy, Loader2, Mail, MessageSquare, Send, X } from "lucide-react";
import type { GroundedFollowUp } from "@/lib/ai/grounding";
import { whatsAppLink } from "@/lib/format";
import { AiFeedbackBar } from "@/components/ai/ai-feedback-bar";
import { Button } from "@/components/ui/button";

export type PermittedActivitySummary = {
  id: string;
  type: string;
  subject: string;
};

type DraftResponse = {
  requestId: string;
  model: string;
  language: "en" | "ta";
  draft: GroundedFollowUp;
  recipient: { name: string; email: string | null; phone: string | null };
};

export function FollowUpDraftPanel({
  entityType,
  entityId,
  entityName,
  activities,
  recipientEmail,
  recipientPhone,
  aiEnabled,
  canUseAi,
}: {
  entityType: "account" | "lead";
  entityId: string;
  entityName: string;
  activities: PermittedActivitySummary[];
  recipientEmail: string | null;
  recipientPhone: string | null;
  aiEnabled: boolean;
  canUseAi: boolean;
}) {
  const [purpose, setPurpose] = useState("");
  const [tone, setTone] = useState<"professional" | "warm" | "concise" | "urgent">("professional");
  const [language, setLanguage] = useState<"en" | "ta">("en");
  const [selectedActivityIds, setSelectedActivityIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DraftResponse | null>(null);
  const [editedSubject, setEditedSubject] = useState("");
  const [editedBody, setEditedBody] = useState("");
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  function toggleActivity(id: string) {
    setSelectedActivityIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  async function generateDraft() {
    if (loading || purpose.trim().length < 3) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    setCopied(false);

    try {
      const response = await fetch("/api/ai/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType,
          entityId,
          activityIds: selectedActivityIds,
          purpose: purpose.trim(),
          tone,
          language,
        }),
        signal: controller.signal,
      });
      const json = (await response.json().catch(() => null)) as (DraftResponse & { error?: string }) | null;
      if (!response.ok || !json?.draft) {
        setError(json?.error ?? "Could not generate follow-up draft.");
        return;
      }
      setResult(json);
      setEditedSubject(json.draft.subject ?? "");
      setEditedBody(json.draft.draft);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("Draft generation cancelled.");
      } else {
        setError("Network error while drafting follow-up.");
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  async function copyDraft() {
    const fullText = editedSubject.trim() ? `Subject: ${editedSubject.trim()}\n\n${editedBody}` : editedBody;
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copy failed. Select and copy the text manually.");
    }
  }

  const waHref = recipientPhone && editedBody.trim() ? whatsAppLink(recipientPhone, editedBody.trim()) : null;
  const mailtoHref =
    recipientEmail && editedBody.trim()
      ? `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(editedSubject.trim())}&body=${encodeURIComponent(editedBody.trim())}`
      : null;

  return (
    <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-2xl">Draft follow-up</h2>
          <p className="text-xs text-muted-foreground">
            Draft an editable message for {entityName} in English or Tamil. Nothing is sent automatically.
          </p>
        </div>
      </div>

      {!aiEnabled ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Enable AI Copilot in{" "}
          <Link href="/settings" className="underline">
            Settings
          </Link>{" "}
          to draft follow-up messages.
        </p>
      ) : !canUseAi ? (
        <p className="mt-3 text-sm text-muted-foreground">Read-only users cannot draft AI messages.</p>
      ) : (
        <div className="mt-3 grid gap-3">
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground">Intended purpose</span>
            <input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              maxLength={500}
              placeholder="e.g. Request pending bank statements for GSTR-3B reconciliation"
              className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus:border-ring"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm">
              <span className="text-muted-foreground">Tone</span>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as typeof tone)}
                className="h-9 rounded-lg border border-input bg-background px-2 text-sm outline-none focus:border-ring"
              >
                <option value="professional">Professional</option>
                <option value="warm">Warm</option>
                <option value="concise">Concise</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="text-muted-foreground">Language</span>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as "en" | "ta")}
                className="h-9 rounded-lg border border-input bg-background px-2 text-sm outline-none focus:border-ring"
              >
                <option value="en">English</option>
                <option value="ta">Tamil (தமிழ்)</option>
              </select>
            </label>
          </div>

          {activities.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Include recent activities (optional)</p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {activities.slice(0, 6).map((act) => (
                  <label key={act.id} className="flex items-start gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={selectedActivityIds.includes(act.id)}
                      onChange={() => toggleActivity(act.id)}
                      className="mt-0.5 size-3.5 accent-[var(--primary)]"
                    />
                    <span className="truncate">
                      {act.type}: {act.subject}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={loading || purpose.trim().length < 3}
              onClick={generateDraft}
              className="whitespace-nowrap shrink-0"
            >
              {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
              {loading ? "Drafting…" : "Draft follow-up"}
            </Button>
            {loading ? (
              <Button type="button" variant="outline" size="sm" onClick={() => abortRef.current?.abort()}>
                <X className="size-3.5" />
                Cancel
              </Button>
            ) : null}
          </div>
        </div>
      )}

      {error ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <span>{error}</span>
          <Button type="button" variant="outline" size="sm" onClick={generateDraft}>
            Retry
          </Button>
        </div>
      ) : null}

      {result ? (
        <div className="mt-4 grid gap-3 border-t border-border pt-4">
          <label className="grid gap-1 text-sm">
            <span className="text-xs text-muted-foreground">Proposed subject (optional for WhatsApp)</span>
            <input
              type="text"
              value={editedSubject}
              onChange={(e) => setEditedSubject(e.target.value)}
              className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus:border-ring"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-xs text-muted-foreground">Message draft (editable)</span>
            <textarea
              rows={6}
              value={editedBody}
              onChange={(e) => setEditedBody(e.target.value)}
              className="rounded-lg border border-input bg-background px-2.5 py-2 text-sm outline-none focus:border-ring"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={copyDraft} className="whitespace-nowrap shrink-0">
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Copied" : "Copy draft"}
            </Button>
            {waHref ? (
              <a
                href={waHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-input bg-background px-3 text-xs font-medium hover:bg-muted"
              >
                <MessageSquare className="size-3.5" />
                Open WhatsApp
              </a>
            ) : null}
            {mailtoHref ? (
              <a
                href={mailtoHref}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-input bg-background px-3 text-xs font-medium hover:bg-muted"
              >
                <Mail className="size-3.5" />
                Open email app
              </a>
            ) : null}
          </div>

          {result.draft.sources.length > 0 ? (
            <div className="text-xs text-muted-foreground">
              <span>Supporting records: </span>
              {result.draft.sources.map((src, idx) => (
                <span key={src.key}>
                  {idx > 0 ? " · " : ""}
                  <Link href={src.href} className="underline">
                    {src.label}
                  </Link>
                </span>
              ))}
            </div>
          ) : null}

          {result.draft.missingDetails.length > 0 ? (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs">
              <p className="font-medium text-foreground">Confirm before sending:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
                {result.draft.missingDetails.map((detail, idx) => (
                  <li key={`missing-${idx}`}>{detail}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <AiFeedbackBar feature="follow_up" requestId={result.requestId} />
        </div>
      ) : null}
    </section>
  );
}
