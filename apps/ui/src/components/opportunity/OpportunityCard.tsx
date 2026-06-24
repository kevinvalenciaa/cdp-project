"use client";

import { CheckCircle2, ChevronRight, Users } from "lucide-react";
import type { Opportunity } from "@/lib/types";
import { liftLabel, moneyCompact, monthlyImpact } from "@/lib/format";
import { StatusPill } from "@/components/common/StatusPill";

export function OpportunityCard({ opportunity, rank, onOpen }: { opportunity: Opportunity; rank: number; onOpen: () => void }) {
  const o = opportunity;
  return (
    <button
      onClick={onOpen}
      className="group w-full cursor-pointer rounded-xl border border-emerald-500/20 bg-card/50 p-4 text-left transition-colors hover:border-emerald-500/40 hover:bg-card focus-visible:border-emerald-500/50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">#{rank}</span>
            <span className="truncate font-semibold text-foreground">{o.title}</span>
            <StatusPill tone="emerald">
              <CheckCircle2 className="h-3 w-3" aria-hidden /> proven
            </StatusPill>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="h-3.5 w-3.5" aria-hidden />
            {o.segment}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-lg font-semibold text-emerald-300">{moneyCompact(monthlyImpact(o))}/mo</div>
          <div className="text-xs text-muted-foreground">est. impact</div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <StatusPill tone="blue">lift {liftLabel(o)}</StatusPill>
          <span className="hidden text-muted-foreground sm:inline">reach {o.reach.toLocaleString()}</span>
        </div>
        <span className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors group-hover:text-foreground">
          Review <ChevronRight className="h-4 w-4" aria-hidden />
        </span>
      </div>
    </button>
  );
}
