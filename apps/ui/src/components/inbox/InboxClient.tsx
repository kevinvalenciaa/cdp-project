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
import { RankingBar } from "@/components/charts";

export function InboxClient({ initialRun, goals }: { initialRun: RunDetail | null; goals: Goal[] }) {
  const [run, setRun] = useState<RunDetail | null>(initialRun);
  const [goal, setGoal] = useState(initialRun?.goal ?? goals[0]?.label ?? "");
  const [selected, setSelected] = useState<Opportunity | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const { events, status, start } = useEventStream<EngineEvent>();

  const running = status === "streaming";
  const ranked = run?.opportunities.ranked ?? [];
  const rejected = run?.opportunities.rejected ?? [];
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
    <div className="space-y-6 p-5 lg:p-8">
      <GoalRunBar goals={goals} value={goal} onValueChange={setGoal} onRun={onRun} running={running} />

      {running ? (
        <div className="rounded-xl border border-border bg-card/40 p-5">
          <div className="mb-3 text-sm font-medium text-foreground">Agents working…</div>
          <ActivityFeed events={events} streaming />
        </div>
      ) : run ? (
        <>
          {trap && <TrapContrastBanner trap={trap} />}
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Ranked opportunities · {ranked.length}
            </h2>
            {ranked.length > 0 && (
              <div className="mb-4 rounded-xl border border-border bg-card/30 p-3">
                <RankingBar opportunities={ranked} />
              </div>
            )}
            <div className="space-y-3">
              {ranked.map((o, i) => (
                <OpportunityCard key={o.key} opportunity={o} rank={i + 1} onOpen={() => openOpp(o)} />
              ))}
            </div>
          </section>
          <RejectedList rejected={rejected} onOpen={openOpp} />
        </>
      ) : (
        <EmptyState icon={Inbox} title="No discovery run yet" description="Pick a goal above and run discovery to surface proven opportunities." />
      )}

      <OpportunityDetail opportunity={selected} activation={run?.activation ?? null} open={detailOpen} onOpenChange={setDetailOpen} />
    </div>
  );
}
