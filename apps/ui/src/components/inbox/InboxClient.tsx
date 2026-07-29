"use client";

import { useState } from "react";
import { AlertTriangle, Inbox, Sparkles } from "lucide-react";
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
  const { events, status, error, start } = useEventStream<EngineEvent>();

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
            Agent active
          </span>
        </div>
        {/* Quantify the work done, with the counts carrying the weight. The rejected count is
            load-bearing: it is the evidence that the Verifier is doing something. */}
        <p className="mt-1.5 text-sm text-muted-foreground">
          {reviewed > 0 ? (
            <>
              Reviewed <strong className="font-medium text-foreground">{reviewed} candidates</strong> since midnight —{" "}
              <strong className="font-medium text-foreground">{ranked.length} proven</strong>,{" "}
              <strong className="font-medium text-foreground">{rejected.length} rejected</strong> for lacking incremental
              lift.
            </>
          ) : (
            "Pick a goal and run discovery to surface proven opportunities."
          )}
        </p>
      </div>

      <GoalRunBar goals={goals} value={goal} onValueChange={setGoal} onRun={onRun} running={running} />

      {/* A failed run used to revert silently to the previous view with no explanation. */}
      {status === "error" && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-ht-danger/25 bg-ht-danger-bg px-4 py-3 text-sm text-ht-danger-text"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span className="min-w-0">
            <strong className="font-medium">Discovery run failed.</strong> {error ?? "Something went wrong."}{" "}
            <button onClick={onRun} className="underline underline-offset-2 hover:no-underline">
              Try again
            </button>
          </span>
        </div>
      )}

      {running ? (
        <div className="rounded-lg border border-border bg-card p-5 shadow-ht-xs">
          <div className="mb-3 text-sm font-medium text-foreground">Agents working…</div>
          <ActivityFeed events={events} streaming />
        </div>
      ) : run ? (
        <>
          {/* h2 so the cards' h3 titles sit at the right level under the page h1 */}
          <h2 className="pt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {ranked.length} {ranked.length === 1 ? "opportunity" : "opportunities"} ranked by estimated impact
          </h2>
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
        <EmptyState
          icon={Inbox}
          title="No discovery run yet"
          description="Pick a goal above and the agents will scan your warehouse, test each candidate against a holdout, and rank what survives."
          action={
            <button
              onClick={onRun}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-ht-teal-hover"
            >
              <Sparkles className="h-4 w-4" aria-hidden /> Run discovery
            </button>
          }
        />
      )}

      {/* Only hand over the activation when it actually belongs to the opportunity being
          viewed — otherwise the Plan tab describes a different campaign's audience. */}
      <OpportunityDetail
        opportunity={selected}
        activation={
          selected && run?.activation?.opportunity.key === selected.key ? run.activation : null
        }
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}
