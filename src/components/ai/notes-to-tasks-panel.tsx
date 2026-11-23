"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { CheckCircle2, ListPlus, Loader2, X } from "lucide-react";
import type { GroundedProposedTask, StaffMember } from "@/lib/ai/grounding";
import { AiFeedbackBar } from "@/components/ai/ai-feedback-bar";
import { Button } from "@/components/ui/button";

type EditableTask = GroundedProposedTask & {
  selected: boolean;
};

type ExtractResponse = {
  requestId: string;
  model: string;
  todayIst: string;
  staff: StaffMember[];
  tasks: GroundedProposedTask[];
};

export function NotesToTasksPanel({
  relatedType,
  relatedId,
  staff,
  aiEnabled,
  canUseAi,
}: {
  relatedType?: "account" | "lead";
  relatedId?: string;
  staff: StaffMember[];
  aiEnabled: boolean;
  canUseAi: boolean;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [availableStaff, setAvailableStaff] = useState<StaffMember[]>(staff);
  const [proposedTasks, setProposedTasks] = useState<EditableTask[]>([]);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function extractTasks() {
    if (extracting || notes.trim().length < 10) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setExtracting(true);
    setError(null);
    setSaveMessage(null);

    try {
      const response = await fetch("/api/ai/notes-to-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: notes.trim(),
          relatedType,
          relatedId,
        }),
        signal: controller.signal,
      });
      const json = (await response.json().catch(() => null)) as (ExtractResponse & { error?: string }) | null;
      if (!response.ok || !json?.tasks) {
        setError(json?.error ?? "Could not extract tasks from notes.");
        return;
      }
      setRequestId(json.requestId);
      setIdempotencyKey(crypto.randomUUID());
      setAvailableStaff(json.staff.length > 0 ? json.staff : staff);
      setProposedTasks(json.tasks.map((task) => ({ ...task, selected: true })));
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("Extraction cancelled.");
      } else {
        setError("Network error while extracting tasks.");
      }
    } finally {
      setExtracting(false);
      abortRef.current = null;
    }
  }

  function updateTask(index: number, patch: Partial<EditableTask>) {
    setProposedTasks((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  async function confirmTasks() {
    if (saving || !idempotencyKey) return;
    const selected = proposedTasks.filter((t) => t.selected && t.title.trim().length > 0);
    if (selected.length === 0) {
      setError("Select at least one proposed task before creating.");
      return;
    }
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/tasks/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey,
          relatedType: relatedType ?? null,
          relatedId: relatedId ?? null,
          tasks: selected.map((task) => ({
            title: task.title.trim(),
            description: task.description.trim(),
            assigneeId: task.assigneeId || null,
            dueDate: task.dueDate || null,
          })),
        }),
      });
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        deduplicated?: boolean;
        createdIds?: string[];
        error?: string;
      } | null;

      if (!response.ok || !json?.ok) {
        setError(json?.error ?? "Could not create tasks.");
        return;
      }

      const count = json.createdIds?.length ?? selected.length;
      setSaveMessage(
        json.deduplicated
          ? `Already saved (${count} task${count === 1 ? "" : "s"} created without duplicates).`
          : `Created ${count} task${count === 1 ? "" : "s"} in Activities.`,
      );
      router.refresh();
    } catch {
      setError("Network error while saving tasks. You can safely retry without duplicating.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div>
        <h2 className="font-display text-2xl">Notes to tasks</h2>
        <p className="text-xs text-muted-foreground">
          Paste meeting notes or a call transcript. Review, edit, and confirm before tasks are saved.
        </p>
      </div>

      {!aiEnabled ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Enable AI Copilot in{" "}
          <Link href="/settings" className="underline">
            Settings
          </Link>{" "}
          to extract proposed tasks.
        </p>
      ) : !canUseAi ? (
        <p className="mt-3 text-sm text-muted-foreground">Read-only users cannot create tasks from notes.</p>
      ) : (
        <div className="mt-3 grid gap-3">
          <textarea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={12_000}
            placeholder="Paste call notes or transcript (e.g. Spoke with Rajesh on Tuesday; Priya to collect Oct bank statement by Friday)..."
            className="rounded-lg border border-input bg-background px-2.5 py-2 text-sm outline-none focus:border-ring"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={extracting || notes.trim().length < 10}
              onClick={extractTasks}
              className="whitespace-nowrap shrink-0"
            >
              {extracting ? <Loader2 className="size-3.5 animate-spin" /> : <ListPlus className="size-3.5" />}
              {extracting ? "Extracting…" : "Extract proposed tasks"}
            </Button>
            {extracting ? (
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
          {!saving && notes.trim().length >= 10 ? (
            <Button type="button" variant="outline" size="sm" onClick={extractTasks}>
              Retry
            </Button>
          ) : null}
        </div>
      ) : null}

      {saveMessage ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-primary" />
            {saveMessage}
          </span>
          <Link href="/activities" className="text-xs underline">
            View in Activities
          </Link>
        </div>
      ) : null}

      {proposedTasks.length > 0 && requestId ? (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Review proposed tasks ({proposedTasks.filter((t) => t.selected).length} selected)
            </p>
            <Button
              type="button"
              size="sm"
              disabled={saving || Boolean(saveMessage)}
              onClick={confirmTasks}
              className="whitespace-nowrap shrink-0"
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {saving ? "Creating…" : saveMessage ? "Tasks saved" : "Confirm & create tasks"}
            </Button>
          </div>

          <ul className="space-y-3">
            {proposedTasks.map((task, idx) => (
              <li key={`pt-${idx}`} className="rounded-lg border border-border bg-background/60 p-3 text-sm">
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={task.selected}
                    disabled={Boolean(saveMessage)}
                    onChange={(e) => updateTask(idx, { selected: e.target.checked })}
                    className="mt-1.5 size-4 accent-[var(--primary)]"
                    aria-label={`Select task ${task.title}`}
                  />
                  <div className="grid flex-1 gap-2.5">
                    <input
                      type="text"
                      value={task.title}
                      disabled={Boolean(saveMessage)}
                      onChange={(e) => updateTask(idx, { title: e.target.value })}
                      className="h-9 rounded-lg border border-input bg-card px-2.5 text-sm font-medium outline-none focus:border-ring"
                    />
                    <textarea
                      rows={2}
                      value={task.description}
                      disabled={Boolean(saveMessage)}
                      onChange={(e) => updateTask(idx, { description: e.target.value })}
                      placeholder="Description"
                      className="rounded-lg border border-input bg-card px-2.5 py-1.5 text-xs outline-none focus:border-ring"
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="grid gap-1 text-xs">
                        <span className="text-muted-foreground">Assignee</span>
                        <select
                          value={task.assigneeId ?? ""}
                          disabled={Boolean(saveMessage)}
                          onChange={(e) => updateTask(idx, { assigneeId: e.target.value || null })}
                          className="h-8 rounded-lg border border-input bg-card px-2 text-xs outline-none focus:border-ring"
                        >
                          <option value="">Unassigned (defaults to you on save)</option>
                          {availableStaff.map((person) => (
                            <option key={person.id} value={person.id}>
                              {person.full_name} ({person.role})
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-1 text-xs">
                        <span className="text-muted-foreground">Due date (IST)</span>
                        <input
                          type="date"
                          value={task.dueDate ?? ""}
                          disabled={Boolean(saveMessage)}
                          onChange={(e) => updateTask(idx, { dueDate: e.target.value || null })}
                          className="h-8 rounded-lg border border-input bg-card px-2 text-xs tabular-nums outline-none focus:border-ring"
                        />
                      </label>
                    </div>
                    {task.supportingExcerpt ? (
                      <p className="rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground">
                        Excerpt: “{task.supportingExcerpt}”
                      </p>
                    ) : null}
                    {task.unresolvedQuestions.length > 0 ? (
                      <div className="text-xs text-amber-700 dark:text-amber-400">
                        <span className="font-medium">Needs clarification: </span>
                        {task.unresolvedQuestions.join(" · ")}
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <AiFeedbackBar feature="notes_to_tasks" requestId={requestId} />
        </div>
      ) : null}
    </section>
  );
}
