"use client";

import Link from "next/link";
import { toast } from "sonner";
import { CheckCircle2, Circle, FlaskConical, Loader2, Rocket, Send, Users } from "lucide-react";
import type { ActivationEvent, ActivationResult, Opportunity } from "@/lib/types";
import type { OpportunityOccurrence } from "@/lib/investigations";
import {
  confidenceLabel,
  controlRate,
  impactBasis,
  isSignificant,
  liftLabel,
  liftMultiple,
  moneyCompact,
  monthlyImpact,
  pctFromPercent,
  pp,
  sourceChips,
  verdictMeta,
} from "@/lib/format";
import { LiftIntervalBar } from "@/components/opportunity/LiftIntervalBar";
import { useEventStream } from "@/lib/use-event-stream";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/common/StatusPill";
import { TreatmentControlBar } from "@/components/charts";

/**
 * The creative brief comes back from the model as light markdown. Rendering it raw leaks
 * literal `**` into the UI, so resolve just the bold runs — the only syntax it actually uses.
 */
function renderBold(text: string) {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-medium text-foreground">
        {part}
      </strong>
    ) : (
      part
    ),
  );
}

export function OpportunityDetail({
  opportunity,
  activation,
  occurrenceId,
  canActivate = true,
  activationStatus = null,
  history = [],
  open,
  onOpenChange,
}: {
  opportunity: Opportunity | null;
  activation: ActivationResult | null;
  occurrenceId?: string;
  canActivate?: boolean;
  activationStatus?: "live" | null;
  history?: OpportunityOccurrence[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { events, status, start, reset } = useEventStream<ActivationEvent>();
  const o = opportunity;

  const finished = events.find((e) => e.kind === "act_finished") as Extract<ActivationEvent, { kind: "act_finished" }> | undefined;
  const result = finished?.result ?? null;
  const lastStep = [...events].reverse().find((e) => e.kind === "step") as Extract<ActivationEvent, { kind: "step" }> | undefined;
  const launching = status === "streaming";

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }
  function approve() {
    if (!o || !canActivate || !occurrenceId) return;
    const params = new URLSearchParams({ key: o.key, occurrenceId });
    start(`/api/activations/stream?${params.toString()}`, (e) => {
      if (e.kind === "act_finished") toast.success(`Launched — measured ${e.result.measurement.upliftPp >= 0 ? "+" : ""}${e.result.measurement.upliftPp.toFixed(1)}pp lift`);
      if (e.kind === "error") toast.error("Activation failed");
    });
  }

  if (!o) return null;
  const control = controlRate(o);
  const vm = verdictMeta(o.verdict);

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto bg-card p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border px-6 py-5 text-left">
          <div className="flex items-center gap-2">
            <StatusPill tone={o.accepted ? "emerald" : vm.tone}>{o.accepted ? "proven" : vm.label}</StatusPill>
            {o.accepted && <span className="font-mono text-sm text-ht-green">{moneyCompact(monthlyImpact(o))}/mo est. impact</span>}
          </div>
          <SheetTitle className="mt-2 text-lg text-foreground">{o.title}</SheetTitle>
          <p className="text-sm text-muted-foreground">{o.segment}</p>
        </SheetHeader>

        <Tabs defaultValue={o.accepted ? "plan" : "analysis"} className="flex flex-1 flex-col">
          <TabsList className="h-auto justify-start gap-4 rounded-none border-b border-border bg-transparent px-6 py-0">
            <TabsTrigger
              value="analysis"
              className="rounded-none border-b-2 border-transparent bg-transparent px-0 pb-2.5 pt-2 text-sm text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              Analysis
            </TabsTrigger>
            {o.accepted && (
              <TabsTrigger
                value="plan"
                className="rounded-none border-b-2 border-transparent bg-transparent px-0 pb-2.5 pt-2 text-sm text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                Plan
              </TabsTrigger>
            )}
            {history.length > 0 && (
              <TabsTrigger
                value="history"
                className="rounded-none border-b-2 border-transparent bg-transparent px-0 pb-2.5 pt-2 text-sm text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                History ({history.length})
              </TabsTrigger>
            )}
          </TabsList>

          {/* Analysis */}
          <TabsContent value="analysis" className="space-y-4 px-6 py-5">
            <p className="text-sm leading-relaxed text-foreground">{o.reason}</p>

            {/* Incremental lift, drawn against zero. Whether the interval crosses zero is the
                whole readout — no p-value literacy required. */}
            {o.upliftPp != null && (
              <div className="rounded-lg border border-border bg-ht-50 p-3.5">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Incremental lift vs holdout</div>
                  {confidenceLabel(o) && (
                    <span
                      className={`inline-flex items-center gap-1 text-xs ${isSignificant(o) ? "text-ht-green" : "text-muted-foreground"}`}
                    >
                      {isSignificant(o) ? (
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                      ) : (
                        <Circle className="h-3.5 w-3.5" aria-hidden />
                      )}
                      {confidenceLabel(o)}
                    </span>
                  )}
                </div>

                <div className="mt-1 text-lg font-semibold tabular-nums text-foreground">{pp(o.upliftPp)}</div>

                <div className="mt-2">
                  <LiftIntervalBar estimate={o.upliftPp} ci={o.ci ?? null} />
                </div>

                <p className="mt-2 text-xs text-muted-foreground">
                  {isSignificant(o)
                    ? "The 95% confidence interval excludes 0%, so this lift is statistically significant."
                    : "Not statistically significant — the 95% confidence interval overlaps 0%."}
                </p>
              </div>
            )}

            {/* The underlying rates. */}
            {control != null && o.rawConversion != null && (
              <div className="rounded-lg border border-border bg-ht-50 p-3.5">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Treatment vs. holdout conversion</div>
                <div className="mt-1 text-sm font-semibold text-foreground">
                  {(() => {
                    const m = liftMultiple(o);
                    return m != null && m >= 1.1 ? `Treatment converts ${m.toFixed(1)}× the holdout` : "Treatment converts above the holdout";
                  })()}
                </div>
                <div className="text-xs text-muted-foreground">
                  {pctFromPercent(o.rawConversion)} treatment vs {pctFromPercent(control)} holdout
                </div>
                <div className="mt-2">
                  <TreatmentControlBar treatmentRate={o.rawConversion} controlRate={control} />
                </div>
                <div className="mt-1 text-center">
                  <StatusPill tone={o.accepted ? "emerald" : "rose"}>lift {liftLabel(o)}</StatusPill>
                </div>
              </div>
            )}
            {o.accepted && (
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ht-green">
                {["proven with a holdout", "not seasonal", "not a trap"].map((t) => (
                  <span key={t} className="inline-flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> {t}
                  </span>
                ))}
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              Activation status:{" "}
              <span className="font-medium text-foreground">{activationStatus ?? "not activated"}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {sourceChips(o).map((s) => (
                <span key={s} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                  {s}
                </span>
              ))}
            </div>
            {!o.accepted && o.bareLlm?.accepted && (
              <div className="rounded-lg border border-ht-danger/20 bg-ht-danger-bg/60 p-3 text-xs text-muted-foreground">
                A generic AI would <span className="text-ht-danger-text">approve</span> this: “{o.bareLlm.reason}” — the Verifier rejected it.
              </div>
            )}
          </TabsContent>

          {/* Plan */}
          {o.accepted && (
            <TabsContent value="plan" className="space-y-4 px-6 py-5">
              {activation ? (
                <>
                  <section>
                    <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Audience</h3>
                    <div className="rounded-lg border border-border bg-ht-50 p-3 text-sm">
                      <div className="flex items-center gap-2 text-foreground">
                        <Users className="h-4 w-4 text-muted-foreground" aria-hidden />
                        {activation.audience.label}
                      </div>
                      <div className="mt-1 tabular-nums text-muted-foreground">
                        reach {activation.audience.reach.toLocaleString()} ·{" "}
                        <span className="text-ht-green">
                          {activation.audience.persuadableReach.toLocaleString()} persuadable
                        </span>{" "}
                        · {activation.audience.channel}
                      </div>
                      <code className="mt-2 block rounded bg-card px-2 py-1 font-mono text-[11px] text-muted-foreground">
                        persuadable: {activation.audience.persuadableSql}
                      </code>
                    </div>
                  </section>

                  {/* Holdout stated before launch, not discovered afterwards. Framing the control
                      group at authoring time is what makes the later lift number credible. */}
                  <section>
                    <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      How we will prove it
                    </h3>
                    <div className="rounded-lg border border-border bg-ht-50 p-3 text-sm">
                      <div className="flex items-center gap-2 text-foreground">
                        <FlaskConical className="h-4 w-4 text-muted-foreground" aria-hidden />
                        Randomised holdout, measured after launch
                      </div>
                      <p className="mt-1 text-muted-foreground">
                        A share of the audience is deliberately withheld. Lift is the difference between the two groups —
                        so the result is causal, not correlational.
                      </p>
                    </div>
                  </section>

                  <section>
                    <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Drafted messaging · {activation.variants.length} variants
                    </h3>
                    <div className="space-y-2">
                      {activation.variants.map((v) => (
                        <div key={v.id} className="rounded-lg border border-border bg-card p-3 text-sm text-foreground">
                          <span className="mr-2 font-mono text-xs text-muted-foreground">{v.id}</span>
                          {v.text}
                        </div>
                      ))}
                    </div>
                    <div className="mt-2">
                      <StatusPill tone="emerald">
                        <CheckCircle2 className="h-3 w-3" aria-hidden /> passes brand guardrails
                      </StatusPill>
                    </div>
                  </section>

                  {activation.brief && (
                    <section>
                      <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        Creative brief
                      </h3>
                      <div className="whitespace-pre-line rounded-lg border border-border bg-ht-50 p-3 text-sm leading-relaxed text-muted-foreground">
                        {renderBold(activation.brief)}
                      </div>
                    </section>
                  )}
                </>
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-ht-50 p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Draft work compiles on approval.</p>
                  <p className="mt-1">
                    Approving compiles the audience from the warehouse, drafts on-brand message variants, runs the brand
                    guardrails, and configures the holdout that will measure incremental lift.
                  </p>
                </div>
              )}

              {launching && (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-ht-50 p-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {lastStep?.label ?? "Launching…"}
                </div>
              )}
              {result && (
                <div className="rounded-lg border border-ht-green-border bg-ht-green-bg/60 p-3 text-sm">
                  <div className="flex items-center gap-1.5 text-ht-green">
                    <Rocket className="h-4 w-4" aria-hidden /> Launched to {result.sync?.destination} <span className="text-muted-foreground">(simulated)</span>
                  </div>
                  <div className="mt-1.5 text-foreground">
                    Measured: treatment {result.measurement.treatmentConv}/{result.measurement.treatmentN} vs control {result.measurement.controlConv}/{result.measurement.controlN} →{" "}
                    <span className="font-medium text-ht-green">
                      {result.measurement.upliftPp >= 0 ? "+" : ""}
                      {result.measurement.upliftPp.toFixed(1)}pp
                    </span>{" "}
                    (p={result.measurement.pValue.toFixed(3)})
                  </div>
                </div>
              )}
              {!canActivate && (
                <div className="rounded-lg border border-ht-warning/25 bg-ht-warning-bg p-3 text-sm text-ht-warning">
                  This evidence is stale or superseded. Open the latest workspace result or run fresh analysis before
                  launching.
                </div>
              )}
            </TabsContent>
          )}

          {history.length > 0 && (
            <TabsContent value="history" className="space-y-3 px-6 py-5">
              <p className="text-sm text-muted-foreground">
                Every immutable occurrence of this opportunity, newest first. Older evidence stays traceable even after
                it can no longer be activated.
              </p>
              {history.map((occurrence, index) => (
                <article key={occurrence.id} className="rounded-lg border border-border bg-ht-50 p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-medium text-foreground">
                        {index === 0 ? "Current workspace result" : "Historical result"}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {new Date(occurrence.verifiedAt).toLocaleString()} · {occurrence.verdict}
                      </div>
                    </div>
                    <StatusPill tone={occurrence.accepted ? "emerald" : "rose"}>
                      {occurrence.accepted ? "accepted" : "rejected"}
                    </StatusPill>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{occurrence.opportunity.reason}</p>
                  <Link
                    href={`/opportunities/${occurrence.investigationId}`}
                    className="mt-2 inline-flex text-xs font-medium text-foreground underline"
                  >
                    {occurrence.sourceInvestigationTitle}
                  </Link>
                </article>
              ))}
            </TabsContent>
          )}
        </Tabs>

        <div className="mt-auto flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          {o.accepted && !result ? (
            <>
              <Button variant="ghost" onClick={() => handleOpenChange(false)}>
                Dismiss
              </Button>
              <Button
                onClick={approve}
                disabled={launching || !canActivate || !occurrenceId}
                className="bg-primary text-primary-foreground hover:bg-ht-teal-hover"
              >
                {launching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {launching ? "Launching…" : "Approve & launch"}
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
