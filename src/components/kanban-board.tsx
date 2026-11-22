"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { formatInr } from "@/lib/format";
import { moveDeal } from "@/server/actions/crm";

type Stage = { id: string; name: string; color: string; is_won: boolean; is_lost: boolean };
type Deal = { id: string; name: string; amount: number; stage_id: string; owner: string; account: string };

export function KanbanBoard({ stages, deals }: { stages: Stage[]; deals: Deal[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className={`flex gap-3 overflow-x-auto pb-4 ${pending ? "opacity-70" : ""}`}>
      {stages.map((stage) => {
        const column = deals.filter((deal) => deal.stage_id === stage.id);
        const total = column.reduce((sum, deal) => sum + Number(deal.amount), 0);
        return (
          <section
            key={stage.id}
            className="w-72 shrink-0 rounded-xl bg-muted/70 p-2"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              const id = event.dataTransfer.getData("text/plain");
              if (!id) return;
              start(async () => {
                await moveDeal(id, stage.id);
                router.refresh();
              });
            }}
          >
            <header className="flex items-center justify-between px-2 py-1.5">
              <h2 className="text-sm font-medium">
                <span className="mr-2 inline-block size-2 rounded-full" style={{ background: stage.color }} />
                {stage.name}
              </h2>
              <span className="text-xs text-muted-foreground">{formatInr(total, 0)}</span>
            </header>
            <div className="grid min-h-24 gap-2">
              {column.map((deal) => (
                <article
                  key={deal.id}
                  draggable
                  onDragStart={(event) => event.dataTransfer.setData("text/plain", deal.id)}
                  className="cursor-grab rounded-lg bg-card p-3 ring-1 ring-foreground/10 active:cursor-grabbing"
                >
                  <p className="text-sm font-medium">{deal.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{deal.account}</p>
                  <p className="mt-2 flex justify-between text-sm">
                    <span>{formatInr(Number(deal.amount), 0)}</span>
                    <span className="text-muted-foreground">{deal.owner}</span>
                  </p>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
