"use client";

import { useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import type { AiFeature } from "@/lib/ai/config";
import { Button } from "@/components/ui/button";

export function AiFeedbackBar({
  feature,
  requestId,
}: {
  feature: AiFeature;
  requestId: string;
}) {
  const [submitted, setSubmitted] = useState<"up" | "down" | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendFeedback(helpful: boolean) {
    if (saving || submitted) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature, requestId, helpful }),
      });
      if (!response.ok) {
        const json = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(json?.error ?? "Could not save feedback.");
      } else {
        setSubmitted(helpful ? "up" : "down");
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
      <span>AI-generated output · Verify against CRM records before acting.</span>
      <div className="flex items-center gap-2">
        {submitted ? (
          <span className="text-foreground">
            Thanks for the feedback ({submitted === "up" ? "Useful" : "Needs work"}).
          </span>
        ) : (
          <>
            <span>Helpful?</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => sendFeedback(true)}
              className="h-7 gap-1 px-2 text-xs whitespace-nowrap shrink-0"
            >
              <ThumbsUp className="size-3.5" />
              Useful
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => sendFeedback(false)}
              className="h-7 gap-1 px-2 text-xs whitespace-nowrap shrink-0"
            >
              <ThumbsDown className="size-3.5" />
              Not useful
            </Button>
          </>
        )}
        {error ? <span className="text-destructive">{error}</span> : null}
      </div>
    </div>
  );
}
