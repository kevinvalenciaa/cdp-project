"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, Sparkles } from "lucide-react";
import type { EngineEvent, Goal, Opportunity, RunDetail } from "@/lib/types";
import { useEventStream } from "@/lib/use-event-stream";
import { moneyCompact, monthlyImpact } from "@/lib/format";
import { AgentPromptBar } from "@/components/inbox/AgentPromptBar";
import { ResultsRail } from "@/components/inbox/ResultsRail";
import { ActivityFeed } from "@/components/activity/ActivityFeed";
import { OpportunityDetail } from "@/components/detail/OpportunityDetail";

/**
 * Opportunities as a conversation. The chat column is where a marketer states
 * intent and watches the agent team work (the run stream IS the reply); the
 * rail is the artifact — proven opportunities ranked by impact, the verifier's
 * saves, and everything analysed and ruled out. One page: ask, watch, review.
 */

interface Turn {
  id: number;
  goal: string;
  /** Snapshotted when the run finishes; the ACTIVE turn streams live instead. */
  events: EngineEvent[];
  run: RunDetail | null;
  failed?: string;
}

export function InboxClient({ initialRun, goals }: { initialRun: RunDetail | null; goals: Goal[] }) {
  const [run, setRun] = useState<RunDetail | null>(initialRun);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [selected, setSelected] = useState<Opportunity | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const { events, status, error, start } = useEventStream<EngineEvent>();
  const running = status === "streaming";
  const feedRef = useRef<HTMLDivElement>(null);

  function send(goal: string) {
    const id = Date.now();
    setTurns((prev) => [...prev, { id, goal, events: [], run: null }]);
    let streamedCost: number | undefined;
    start(`/api/run/stream?goal=${encodeURIComponent(goal)}`, (e) => {
      if (e.kind === "cost") streamedCost = e.usd;
      if (e.kind === "run_finished") {
        // The demo fixture's RunDetail has no costUsd; the stream's cost event does.
        const result = { ...e.result, costUsd: e.result.costUsd ?? streamedCost };
        setRun(result);
        setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, run: result } : t)));
      }
    });
  }

  // Snapshot the stream into the turn when it settles (done or error), so past
  // turns keep their transcript when the hook's buffer is reused by the next run.
  useEffect(() => {
    if (status !== "done" && status !== "error") return;
    setTurns((prev) => {
      const last = prev[prev.length - 1];
      if (!last || last.events.length > 0) return prev;
      return prev.map((t) =>
        t.id === last.id ? { ...t, events, failed: status === "error" ? (error ?? "Something went wrong.") : undefined } : t,
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Keep the conversation pinned to the newest message while streaming.
  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
  }, [events.length, turns.length]);

  function openOpp(o: Opportunity) {
    setSelected(o);
    setDetailOpen(true);
  }

  const lastTurn = turns[turns.length - 1] ?? null;

  return (
    // Fixed-height two-pane on xl; normal document flow (chat, then results) below.
    <div className="xl:flex xl:h-[calc(100dvh-3.5rem)]">
      {/* Conversation column */}
      <div className="flex min-w-0 flex-col xl:flex-1">
        <div ref={feedRef} className="xl:flex-1 xl:overflow-y-auto">
          <div className="mx-auto w-full max-w-2xl space-y-6 px-5 py-6">
            {turns.length === 0 && (
              <div className="flex min-h-[45vh] flex-col items-center justify-center text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-ht-teal-tint">
                  <Sparkles className="h-5 w-5 text-ht-teal" aria-hidden />
                </div>
                <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground">
                  What should the agents optimize?
                </h1>
                <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
                  Describe a goal below. The agent team scans your warehouse, tests every candidate against a
                  holdout, and ranks what survives{run ? " — the last run's results are in the panel." : "."}
                </p>
              </div>
            )}

            {turns.map((t) => {
              const isActive = t === lastTurn && running;
              const turnEvents = t.events.length > 0 ? t.events : t === lastTurn ? events : [];
              return (
                <div key={t.id} className="space-y-4">
                  {/* The marketer's message */}
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-ht-xs">
                      {t.goal}
                    </div>
                  </div>

                  {/* The agent team's reply: live narration, then the receipt */}
                  <div className="flex gap-3">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ht-teal-tint">
                      <Sparkles className="h-3.5 w-3.5 text-ht-teal" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3 shadow-ht-xs">
                        <ActivityFeed events={turnEvents} streaming={isActive} />
                      </div>
                      {t.failed && (
                        <div
                          role="alert"
                          className="flex items-start gap-2.5 rounded-xl border border-ht-danger/25 bg-ht-danger-bg px-4 py-3 text-sm text-ht-danger-text"
                        >
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                          <span>
                            <strong className="font-medium">Discovery run failed.</strong> {t.failed}{" "}
                            <button onClick={() => send(t.goal)} className="underline underline-offset-2 hover:no-underline">
                              Try again
                            </button>
                          </span>
                        </div>
                      )}
                      {t.run && <RunSummary run={t.run} />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* The input, pinned to the bottom of the conversation */}
        <div className="sticky bottom-0 border-t border-border bg-background/80 px-5 py-4 backdrop-blur xl:static">
          <div className="mx-auto w-full max-w-2xl">
            <AgentPromptBar goals={goals} running={running} onSend={send} autoFocus={turns.length === 0} />
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Every claim is tested against a holdout before it reaches this screen.
            </p>
          </div>
        </div>
      </div>

      {/* Results rail: right pane on xl, stacked section below the chat otherwise */}
      <aside
        className="border-t border-border bg-ht-50/50 xl:w-[400px] xl:shrink-0 xl:overflow-y-auto xl:border-l xl:border-t-0"
        aria-label="Run results"
      >
        <ResultsRail run={run} onOpen={openOpp} />
      </aside>

      <OpportunityDetail
        opportunity={selected}
        activation={selected && run?.activation?.opportunity.key === selected.key ? run.activation : null}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}

/** The closing message of an agent turn: the receipt, pointing at the rail. */
function RunSummary({ run }: { run: RunDetail }) {
  const ranked = run.opportunities.ranked;
  const rejected = run.opportunities.rejected;
  const impact = ranked.reduce((s, o) => s + monthlyImpact(o), 0);
  const caught = rejected.filter((o) => o.bareLlm?.accepted).length;
  return (
    <div className="rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3 text-sm shadow-ht-xs">
      <p className="text-foreground">
        Done — <strong className="font-semibold">{ranked.length} proven</strong> (~
        <span className="font-mono tabular-nums text-ht-green">{moneyCompact(impact)}/mo</span> est. impact),{" "}
        <strong className="font-semibold">{rejected.length} ruled out</strong>
        {caught > 0 && (
          <>
            {" "}
            including <strong className="font-semibold text-ht-danger-text">{caught} caught</strong> before{" "}
            {caught === 1 ? "it" : "they"} cost you
          </>
        )}
        {run.costUsd != null && (
          <span className="text-muted-foreground">
            {" "}
            · run cost <span className="font-mono tabular-nums">${run.costUsd.toFixed(2)}</span>
          </span>
        )}
        .
      </p>
      <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
        Full ranking in the results panel <ArrowRight className="h-3 w-3" aria-hidden />
      </p>
    </div>
  );
}
