"use client";

import { Brain, CheckCheck, CheckCircle2, CircleDashed, Clock, Flag, Lightbulb, ListOrdered, Loader2, ShieldCheck, Telescope, XCircle } from "lucide-react";
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

function iconColor(tone: Tone): string {
  return {
    emerald: "text-ht-green",
    rose: "text-ht-danger",
    amber: "text-ht-warning",
    blue: "text-ht-teal",
    slate: "text-muted-foreground",
  }[tone];
}

export function ActivityFeed({ events, streaming }: { events: EngineEvent[]; streaming?: boolean }) {
  const totalCost = events.reduce((c, e) => (e.kind === "cost" ? e.usd : c), 0);
  const visible = events.filter((e) => e.kind !== "cost" && e.kind !== "run_finished");

  return (
    <ol className="space-y-1" aria-live="polite">
      {visible.map((e, i) => {
        if (e.kind === "run_started")
          return (
            <Row key={i} icon={<Flag className="h-4 w-4 text-ht-teal" />}>
              <span className="text-foreground">Investigating {e.candidateCount} candidates</span>
              <span className="text-muted-foreground"> for “{e.goal}”</span>
            </Row>
          );
        if (e.kind === "explorer_started")
          return (
            <Row key={i} icon={<Telescope className="h-4 w-4 text-ht-teal" />}>
              <span className="text-foreground">Explorer proposing hypotheses</span>
              <span className="text-muted-foreground"> across {e.probeCount} candidates</span>
            </Row>
          );
        if (e.kind === "hypothesis_proposed")
          return (
            <Row key={i} icon={<Lightbulb className="h-4 w-4 text-ht-teal" />}>
              <span className="text-foreground/80">{e.text}</span>
              {!e.matchedProbe && (
                <StatusPill tone="slate" className="ml-2 align-middle">
                  unexplored
                </StatusPill>
              )}
            </Row>
          );
        if (e.kind === "planning")
          return (
            <Row key={i} icon={<Brain className="h-4 w-4 text-ht-teal" />}>
              <span className="text-foreground/80">{e.text}</span>
            </Row>
          );
        if (e.kind === "memory_hit")
          return (
            <Row key={i} icon={<Brain className="h-4 w-4 text-muted-foreground" />}>
              <span className="text-muted-foreground">
                Skipping {e.subject} — memory: {e.claim}
              </span>
            </Row>
          );
        if (e.kind === "prioritizing")
          return (
            <Row key={i} icon={<ListOrdered className="h-4 w-4 text-ht-teal" />}>
              <span className="text-foreground">Ranking {e.acceptedCount} verified opportunities</span>
              <span className="text-muted-foreground"> by {e.formula}</span>
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
              <span className="text-foreground">{e.title}</span>
              <StatusPill tone={meta.tone} className="ml-2 align-middle">
                {meta.label}
              </StatusPill>
              {e.grounded !== undefined && (
                <StatusPill tone={e.grounded ? "emerald" : "rose"} className="ml-1.5 align-middle">
                  <ShieldCheck className="h-3 w-3" /> {e.grounded ? "grounded" : "ungrounded"}
                </StatusPill>
              )}
            </Row>
          );
        }
        if (e.kind === "error")
          return (
            <Row key={i} icon={<XCircle className="h-4 w-4 text-ht-danger" />}>
              <span className="text-ht-danger-text">{e.message}</span>
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
        <Row icon={<CheckCheck className="h-4 w-4 text-ht-green" />}>
          <span className="text-foreground">Done.</span>
          {totalCost > 0 && <span className="ml-1 font-mono text-xs text-muted-foreground">${totalCost.toFixed(3)}</span>}
        </Row>
      )}
    </ol>
  );
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex animate-slide-up items-center gap-2.5 rounded-md px-2 py-1.5 text-sm">
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 truncate">{children}</span>
    </li>
  );
}
