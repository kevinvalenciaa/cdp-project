"use client";

import type { Opportunity } from "@/lib/types";
import { verdictMeta } from "@/lib/format";
import { StatusPill } from "@/components/common/StatusPill";

export function RejectedList({ rejected, onOpen }: { rejected: Opportunity[]; onOpen: (o: Opportunity) => void }) {
  if (rejected.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Reviewed &amp; not surfaced · {rejected.length}
      </h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {rejected.map((o) => {
          const m = verdictMeta(o.verdict);
          return (
            <button
              key={o.key}
              onClick={() => onOpen(o)}
              className="rounded-lg border border-border bg-card p-3 text-left shadow-ht-xs transition-colors hover:border-ht-400"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-foreground">{o.title}</span>
                <StatusPill tone={m.tone}>{m.label}</StatusPill>
              </div>
              <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{o.reason}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
