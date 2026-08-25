"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Archive,
  Check,
  FileChartColumn,
  Loader2,
  PanelRightClose,
  Share2,
  Sparkles,
} from "lucide-react";
import type {
  InvestigationDetail,
  InvestigationEventEnvelope,
  OpportunityOccurrence,
} from "@/lib/investigations";
import type { EngineEvent, Opportunity, RunDetail } from "@/lib/types";
import { usePersistedToggle } from "@/lib/use-persisted-toggle";
import { PromptInputBox } from "@/components/ui/ai-prompt-box";
import { InvestigationPlan } from "@/components/inbox/InvestigationPlan";
import { ResultsRail } from "@/components/inbox/ResultsRail";
import { OpportunityDetail } from "@/components/detail/OpportunityDetail";
import { ShareInvestigationDialog } from "@/components/inbox/ShareInvestigationDialog";

export function InvestigationClient({ initialInvestigation }: { initialInvestigation: InvestigationDetail }) {
  const router = useRouter();
  const [investigation, setInvestigation] = useState(initialInvestigation);
  const [liveEvents, setLiveEvents] = useState<Record<string, EngineEvent[]>>({});
  const [railOpen, toggleRail] = usePersistedToggle("ui.results-rail-open", false);
  const [selected, setSelected] = useState<OpportunityOccurrence | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [title, setTitle] = useState(initialInvestigation.title);
  const [error, setError] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const lastEventRef = useRef(0);

  const reload = useCallback(async () => {
    const response = await fetch(`/api/investigations/${initialInvestigation.id}`, { cache: "no-store" });
    if (!response.ok) return;
    const payload = (await response.json()) as { investigation: InvestigationDetail };
    setInvestigation(payload.investigation);
    setTitle(payload.investigation.title);
    router.refresh();
  }, [initialInvestigation.id, router]);

  useEffect(() => {
    const source = new EventSource(
      `/api/investigations/${initialInvestigation.id}/events?after=${lastEventRef.current}`,
    );
    source.onmessage = (message) => {
      const envelope = JSON.parse(message.data) as InvestigationEventEnvelope;
      lastEventRef.current = Math.max(lastEventRef.current, envelope.id);
      if (envelope.runId && isEngineEvent(envelope.event)) {
        setLiveEvents((current) => ({
          ...current,
          [envelope.runId!]: [...(current[envelope.runId!] ?? []), envelope.event as EngineEvent],
        }));
      }
      if (
        envelope.event.kind === "run_finished" ||
        envelope.event.kind === "error" ||
        envelope.event.kind === "message_answered" ||
        envelope.event.kind === "clarification_requested" ||
        envelope.event.kind === "run_queued" ||
        envelope.event.kind === "run_cancelled"
      ) {
        void reload();
      }
    };
    source.onerror = () => {
      // EventSource reconnects with Last-Event-ID. Persisted events make a
      // transient disconnect harmless.
    };
    return () => source.close();
  }, [initialInvestigation.id, reload]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [investigation.messages.length, liveEvents]);

  const activeRun = investigation.runs.find((run) => run.status === "queued" || run.status === "running") ?? null;
  const activeTurn =
    activeRun != null ||
    investigation.messages.some(
      (message) => message.status === "queued" || message.status === "running",
    );
  const latestCompleted = [...investigation.runs].reverse().find((run) => run.status === "completed" && run.result) ?? null;
  const scopedRun = useMemo<RunDetail | null>(() => {
    if (!latestCompleted?.result && investigation.results.length === 0) return null;
    const base = latestCompleted?.result;
    if (!base) return null;
    return {
      ...base,
      goal: investigation.objective,
      opportunities: {
        ranked: investigation.results.filter((result) => result.accepted).map((result) => result.opportunity),
        rejected: investigation.results.filter((result) => !result.accepted).map((result) => result.opportunity),
      },
    };
  }, [investigation.objective, investigation.results, latestCompleted]);
  const supersededResults = investigation.results.filter(
    (result) => result.supersededByOccurrenceId != null,
  );

  async function send(raw: string, intentHint: "auto" | "investigate" = "auto") {
    const content = raw.replace(/^\[(?:Search|Think): ([\s\S]*)\]$/, "$1").trim();
    if (!content || activeTurn || investigation.status === "archived") return;
    setError(null);
    try {
      const response = await fetch(`/api/investigations/${investigation.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, clientMessageId: crypto.randomUUID(), intentHint }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not send the message.");
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send the message.");
    }
  }

  async function stop() {
    if (!activeRun) return;
    await fetch(`/api/runs/${activeRun.id}/cancel`, { method: "POST" });
    await reload();
  }

  async function saveTitle() {
    const next = title.trim();
    if (!next || next === investigation.title) {
      setTitle(investigation.title);
      return;
    }
    const response = await fetch(`/api/investigations/${investigation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: next }),
    });
    if (response.ok) await reload();
  }

  async function archive() {
    const response = await fetch(`/api/investigations/${investigation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    });
    if (response.ok) await reload();
  }

  function openOpportunity(opportunity: Opportunity) {
    setSelected(
      investigation.results.find((result) => result.opportunityKey === opportunity.key) ?? null,
    );
  }

  return (
    <>
      <div className="bg-background xl:flex xl:h-full xl:gap-4 xl:p-4">
        <div className="relative flex min-w-0 flex-1 flex-col bg-card xl:overflow-hidden xl:rounded-[20px] xl:border xl:border-border xl:shadow-ht-xs">
          <div className="flex min-h-16 items-center gap-3 border-b border-border px-5 pr-36">
            <Link href="/investigations" className="text-xs text-muted-foreground hover:text-foreground">
              Investigations
            </Link>
            <span className="text-muted-foreground">/</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={saveTitle}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              className="min-w-0 flex-1 truncate bg-transparent text-sm font-medium text-foreground outline-none"
              aria-label="Investigation title"
            />
            {activeRun && (
              <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                {activeRun.status}
              </span>
            )}
          </div>

          <div className="absolute right-4 top-3 z-10 flex items-center gap-1.5">
            {!railOpen && (
              <button
                onClick={toggleRail}
                aria-label="Open results"
                title="Open results"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-foreground transition-colors hover:border-border hover:bg-muted"
              >
                <FileChartColumn className="h-5 w-5" aria-hidden />
              </button>
            )}
            <button
              onClick={() => setShareOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-3.5 text-sm font-semibold text-primary-foreground shadow-ht-xs transition-all hover:-translate-y-px hover:bg-ht-teal-hover"
            >
              <Share2 className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Share</span>
            </button>
          </div>

          <div ref={feedRef} className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-3xl space-y-7 px-5 py-7 sm:px-7 lg:py-9">
              <div className="rounded-2xl border border-border bg-background px-4 py-3.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Investigation objective
                </div>
                <p className="mt-1 text-sm text-foreground">{investigation.objective}</p>
              </div>

              {investigation.messages.map((message) => {
                const run = message.runId
                  ? investigation.runs.find((candidate) => candidate.id === message.runId)
                  : null;
                const events = message.runId ? liveEvents[message.runId] ?? [] : [];
                return (
                  <div key={message.id}>
                    {message.role === "user" ? (
                      <div className="flex justify-end">
                        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm leading-relaxed text-primary-foreground shadow-ht-xs">
                          {message.content}
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-3">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-ht-teal-tint">
                          <Sparkles className="h-3.5 w-3.5 text-ht-teal" aria-hidden />
                        </div>
                        <div className="min-w-0 flex-1">
                          {run && (run.status === "queued" || run.status === "running") ? (
                            <div className="rounded-2xl rounded-tl-md border border-border bg-background px-4 py-3.5 shadow-ht-xs">
                              <InvestigationPlan events={events} streaming />
                            </div>
                          ) : (
                            <div
                              className={`whitespace-pre-wrap rounded-2xl rounded-tl-md border px-4 py-3 text-sm leading-relaxed shadow-ht-xs ${
                                message.status === "error"
                                  ? "border-ht-danger/25 bg-ht-danger-bg text-ht-danger-text"
                                  : "border-border bg-background text-foreground"
                              }`}
                            >
                              {message.status === "queued" || message.status === "running" ? (
                                <span className="inline-flex items-center gap-2 text-muted-foreground">
                                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {message.content}
                                </span>
                              ) : (
                                message.content
                              )}
                            </div>
                          )}
                          {message.citations.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {message.citations.map((citation) => {
                                const result = investigation.results.find((candidate) => candidate.id === citation);
                                return result ? (
                                  <button
                                    key={citation}
                                    onClick={() => setSelected(result)}
                                    className="rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-ht-400 hover:text-foreground"
                                  >
                                    {result.opportunity.title}
                                  </button>
                                ) : null;
                              })}
                            </div>
                          )}
                          {message.role === "assistant" &&
                            message.status === "complete" &&
                            message.content.includes("Run fresh analysis") &&
                            !activeTurn && (
                              <button
                                onClick={() =>
                                  void send(
                                    `Run fresh analysis for: ${investigation.objective}`,
                                    "investigate",
                                  )
                                }
                                className="mt-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
                              >
                                Run fresh analysis
                              </button>
                            )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {error && (
                <div role="alert" className="flex items-center gap-2 text-sm text-ht-danger-text">
                  <AlertTriangle className="h-4 w-4" aria-hidden /> {error}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-border bg-card/90 px-5 py-4 backdrop-blur sm:px-7">
            <div className="mx-auto w-full max-w-3xl">
              {investigation.status === "archived" ? (
                <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                  <Archive className="h-4 w-4" aria-hidden /> This investigation is archived and read-only.
                </div>
              ) : (
                <PromptInputBox
                  onSend={(message) => send(message)}
                  onStop={stop}
                  isLoading={activeTurn}
                  placeholder={activeTurn ? "Investigation running…" : "Ask about these results or start fresh analysis…"}
                />
              )}
              <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Answers cite this investigation; fresh analysis is queued automatically.</span>
                {investigation.status === "active" && !activeTurn && (
                  <button onClick={archive} className="hover:text-foreground">
                    Archive
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {railOpen && (
          <button
            aria-label="Close results"
            className="fixed inset-0 z-30 bg-black/20 xl:hidden"
            onClick={toggleRail}
          />
        )}
        <aside
          className={`bg-card/95 backdrop-blur transition-[width] duration-200 ease-out ${
            railOpen
              ? "fixed inset-x-0 bottom-0 z-40 max-h-[78vh] overflow-y-auto rounded-t-[24px] border-t border-border shadow-ht-md xl:static xl:z-auto xl:max-h-none xl:w-[420px] xl:shrink-0 xl:rounded-[20px] xl:border xl:border-t xl:shadow-ht-xs"
              : "hidden xl:invisible xl:block xl:w-0 xl:shrink-0 xl:overflow-hidden"
          }`}
          aria-label="Investigation results"
          aria-hidden={!railOpen}
        >
          <div className="xl:w-[420px]">
            <div className="flex items-center justify-between border-b border-border px-4 py-4 lg:px-5">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Investigation results
                </span>
                {activeRun && <p className="text-[11px] text-muted-foreground">Keeping completed evidence visible while this run finishes.</p>}
              </div>
              <button
                onClick={toggleRail}
                aria-label="Hide results panel"
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <PanelRightClose className="h-4 w-4" aria-hidden />
              </button>
            </div>
            {supersededResults.length > 0 && (
              <div className="mx-4 mt-4 rounded-xl border border-ht-warning/25 bg-ht-warning-bg px-3 py-2.5 text-xs text-ht-warning lg:mx-5">
                {supersededResults.length} historical{" "}
                {supersededResults.length === 1 ? "result has" : "results have"} been superseded by newer workspace
                evidence.{" "}
                <Link href="/opportunities" className="font-medium underline">
                  Open current truth
                </Link>
              </div>
            )}
            <ResultsRail run={scopedRun} onOpen={openOpportunity} />
          </div>
        </aside>
      </div>

      <OpportunityDetail
        opportunity={selected?.opportunity ?? null}
        activation={
          selected && latestCompleted?.result?.activation?.opportunity.key === selected.opportunityKey
            ? latestCompleted.result.activation
            : null
        }
        occurrenceId={selected?.id}
        canActivate={
          Boolean(selected?.accepted) &&
          selected?.supersededByOccurrenceId == null &&
          new Date(selected?.validUntil ?? 0).getTime() > Date.now()
        }
        open={selected != null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />

      <ShareInvestigationDialog
        investigationId={investigation.id}
        open={shareOpen}
        onOpenChange={setShareOpen}
      />
    </>
  );
}

function isEngineEvent(
  event: InvestigationEventEnvelope["event"],
): event is EngineEvent {
  return (
    event.kind === "run_started" ||
    event.kind === "explorer_started" ||
    event.kind === "hypothesis_proposed" ||
    event.kind === "planning" ||
    event.kind === "memory_hit" ||
    event.kind === "candidate_started" ||
    event.kind === "candidate_verified" ||
    event.kind === "prioritizing" ||
    event.kind === "cost" ||
    event.kind === "run_finished" ||
    event.kind === "error"
  );
}
