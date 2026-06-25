"use client";

import { useState } from "react";
import { Inbox } from "lucide-react";
import type { EngineEvent, Goal, Opportunity, RunDetail } from "@/lib/types";
import { useEventStream } from "@/lib/use-event-stream";
import { GoalRunBar } from "@/components/opportunity/GoalRunBar";
import { OpportunityCard } from "@/components/opportunity/OpportunityCard";
import { TrapContrastBanner } from "@/components/opportunity/TrapContrastBanner";
import { RejectedList } from "@/components/opportunity/RejectedList";
import { OpportunityDetail } from "@/components/detail/OpportunityDetail";
import { ActivityFeed } from "@/components/activity/ActivityFeed";
import { EmptyState } from "@/components/common/EmptyState";

export function InboxClient({ initialRun, goals }: { initialRun: RunDetail | null; goals: Goal[] }) {
  const [run, setRun] = useState<RunDetail | null>(initialRun);
  const [goal, setGoal] = useState(initialRun?.goal ?? goals[0]?.label ?? "");
  const [selected, setSelected] = useState<Opportunity | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const { events, status, start } = useEventStream<EngineEvent>();

  const running = status === "streaming";
  const ranked = run?.opportunities.ranked ?? [];
  const rejected = run?.opportunities.rejected ?? [];
  const reviewed = ranked.length + rejected.length;
  const trap = rejected.filter((o) => o.bareLlm).sort((a, b) => (b.rawConversion ?? 0) - (a.rawConversion ?? 0))[0] ?? null;

  function onRun() {
    if (!goal.trim()) return;
    start(`/api/run/stream?goal=${encodeURIComponent(goal)}`, (e) => {
      if (e.kind === "run_finished") setRun(e.result);
    });
  }
  function openOpp(o: Opportunity) {
    setSelected(o);
    setDetailOpen(true);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-5 lg:p-8">
      {/* Header */}
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Opportunities</h1>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ht-green-bg px-2.5 py-1 text-xs font-medium text-ht-green ring-1 ring-ht-green-border">
            <span className="h-1.5 w-1.5 rounded-full bg-ht-green" aria-hidden />
            Agent active · last run 4:02 AM
          </span>
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {reviewed > 0
            ? `Reviewed ${reviewed} candidate campaigns and segments, plus the order time-series, since midnight.`
            : "Pick a goal and run discovery to surface proven opportunities."}
        </p>
      </div>

      <GoalRunBar goals={goals} value={goal} onValueChange={setGoal} onRun={onRun} running={running} />

      {running ? (
        <div className="rounded-lg border border-border bg-card p-5 shadow-ht-xs">
          <div className="mb-3 text-sm font-medium text-foreground">Agents working…</div>
          <ActivityFeed events={events} streaming />
        </div>
      ) : run ? (
        <>
          <div className="pt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {ranked.length} {ranked.length === 1 ? "opportunity" : "opportunities"} ranked by estimated impact
          </div>
          <div className="space-y-4">
            {ranked.map((o, i) => (
              <div key={o.key} className="flex items-start gap-3">
                <span className="w-7 shrink-0 pt-4 text-right font-mono text-lg font-medium text-ht-400">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <OpportunityCard opportunity={o} onOpen={() => openOpp(o)} />
                </div>
              </div>
            ))}
          </div>
          {trap && <TrapContrastBanner trap={trap} />}
          <RejectedList rejected={rejected} onOpen={openOpp} />
        </>
      ) : (
        <EmptyState icon={Inbox} title="No discovery run yet" description="Pick a goal above and run discovery." />
      )}

      <OpportunityDetail opportunity={selected} activation={run?.activation ?? null} open={detailOpen} onOpenChange={setDetailOpen} />
    </div>
  );
}
