"use client";

import { Brain, CheckCheck, CheckCircle2, CircleDashed, Clock, Flag, Loader2, XCircle } from "lucide-react";
import type { EngineEvent } from "@/lib/types";
import { cn } from "@/lib/utils";
import { StatusPill } from "@/components/common/StatusPill";
import type { Tone } from "@/lib/format";

const CATEGORY: Record<string, { tone: Tone; label: string; Icon: typeof CheckCircle2 }> = {
  found: { tone: "emerald", label: "found", Icon: CheckCircle2 },
  "rejected-trap": { tone: "rose", label: "rejected · trap", Icon: XCircle },
  "rejected-seasonal": { tone: "amber", label: "rejected · seasonal", Icon: XCircle },
  "needs-test": { tone: "amber", label: "needs a test", Icon: Clock },
};

export function ActivityFeed({ events, streaming }: { events: EngineEvent[]; streaming?: boolean }) {
  const totalCost = events.reduce((c, e) => (e.kind === "cost" ? e.usd : c), 0);
  const visible = events.filter((e) => e.kind !== "cost" && e.kind !== "run_finished");

  return (
    <ol className="space-y-1.5" aria-live="polite">
      {visible.map((e, i) => {
        if (e.kind === "run_started")
          return (
            <Row key={i} icon={<Flag className="h-4 w-4 text-primary" />}>
              <span className="text-foreground">Investigating {e.candidateCount} candidates</span>
              <span className="text-muted-foreground"> for “{e.goal}”</span>
            </Row>
          );
        if (e.kind === "planning")
          return (
            <Row key={i} icon={<Brain className="h-4 w-4 text-sky-400" />}>
              <span className="text-slate-300">{e.text}</span>
            </Row>
          );
        if (e.kind === "candidate_started")
          return (
            <Row key={i} icon={<CircleDashed className="h-4 w-4 text-muted-foreground" />}>
              <span className="text-muted-foreground">Investigating {e.title}…</span>
            </Row>
          );
        if (e.kind === "candidate_verified") {
          const meta = CATEGORY[e.category] ?? CATEGORY.found;
          return (
            <Row key={i} icon={<meta.Icon className={cn("h-4 w-4", iconColor(meta.tone))} />}>
              <span className="text-slate-200">{e.title}</span>
              <StatusPill tone={meta.tone} className="ml-2 align-middle">
                {meta.label}
              </StatusPill>
            </Row>
          );
        }
        if (e.kind === "error")
          return (
            <Row key={i} icon={<XCircle className="h-4 w-4 text-rose-400" />}>
              <span className="text-rose-300">{e.message}</span>
            </Row>
          );
        return null;
      })}
      {streaming && (
        <Row icon={<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}>
          <span className="text-muted-foreground">Working…</span>
        </Row>
      )}
      {!streaming && events.some((e) => e.kind === "run_finished") && (
        <Row icon={<CheckCheck className="h-4 w-4 text-emerald-400" />}>
          <span className="text-foreground">Done.</span>
          {totalCost > 0 && <span className="ml-1 font-mono text-xs text-muted-foreground">${totalCost.toFixed(3)}</span>}
        </Row>
      )}
    </ol>
  );
}

function iconColor(tone: Tone): string {
  return { emerald: "text-emerald-400", rose: "text-rose-400", amber: "text-amber-400", blue: "text-sky-400", slate: "text-slate-400" }[tone];
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex animate-slide-up items-center gap-2.5 rounded-md px-2 py-1.5 text-sm">
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 truncate">{children}</span>
    </li>
  );
}
