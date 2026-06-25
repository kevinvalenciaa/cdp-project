"use client";

import { toast } from "sonner";
import { CheckCircle2, Loader2, Rocket, Send, Users } from "lucide-react";
import type { ActivationEvent, ActivationResult, Opportunity } from "@/lib/types";
import { liftLabel, moneyCompact, monthlyImpact, pct, sourceChips, verdictMeta } from "@/lib/format";
import { useEventStream } from "@/lib/use-event-stream";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/common/StatusPill";
import { TreatmentControlBar } from "@/components/charts";

export function OpportunityDetail({
  opportunity,
  activation,
  open,
  onOpenChange,
}: {
  opportunity: Opportunity | null;
  activation: ActivationResult | null;
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
    if (!o) return;
    start(`/api/activations/stream?key=${encodeURIComponent(o.key)}`, (e) => {
      if (e.kind === "act_finished") toast.success(`Launched — measured ${e.result.measurement.upliftPp >= 0 ? "+" : ""}${e.result.measurement.upliftPp.toFixed(1)}pp lift`);
      if (e.kind === "error") toast.error("Activation failed");
    });
  }

  if (!o) return null;
  const control = o.rawConversion != null && o.upliftPp != null ? Math.max(0, o.rawConversion - o.upliftPp / 100) : null;
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
          </TabsList>

          {/* Analysis */}
          <TabsContent value="analysis" className="space-y-4 px-6 py-5">
            <p className="text-sm leading-relaxed text-foreground">{o.reason}</p>
            {control != null && o.rawConversion != null && (
              <div className="rounded-lg border border-border bg-ht-50 p-3.5">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Treatment vs. holdout conversion</div>
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
            <div className="flex flex-wrap gap-1.5">
              {sourceChips(o).map((s) => (
                <span key={s} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                  {s}
                </span>
              ))}
            </div>
            {!o.accepted && o.bareLlm && (
              <div className="rounded-lg border border-ht-danger/20 bg-ht-danger-bg/60 p-3 text-xs text-muted-foreground">
                A generic AI would <span className="text-ht-danger-text">approve</span> this: “{o.bareLlm.reason}” — the Verifier rejected it.
              </div>
            )}
          </TabsContent>

          {/* Plan */}
          {o.accepted && activation && (
            <TabsContent value="plan" className="space-y-4 px-6 py-5">
              <div className="rounded-lg border border-border bg-ht-50 p-3 text-sm">
                <div className="flex items-center gap-2 text-foreground">
                  <Users className="h-4 w-4 text-muted-foreground" aria-hidden />
                  {activation.audience.label}
                </div>
                <div className="mt-1 text-muted-foreground">
                  reach {activation.audience.reach.toLocaleString()} · <span className="text-ht-green">{activation.audience.persuadableReach.toLocaleString()} persuadable</span> · {activation.audience.channel}
                </div>
              </div>
              {activation.variants.map((v) => (
                <div key={v.id} className="rounded-lg border border-border bg-card p-3 text-sm text-foreground">
                  <span className="mr-2 font-mono text-xs text-muted-foreground">{v.id}</span>
                  {v.text}
                </div>
              ))}
              <StatusPill tone="emerald">
                <CheckCircle2 className="h-3 w-3" aria-hidden /> guardrail clear
              </StatusPill>

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
            </TabsContent>
          )}
        </Tabs>

        <div className="mt-auto flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          {o.accepted && !result ? (
            <>
              <Button variant="ghost" onClick={() => handleOpenChange(false)}>
                Dismiss
              </Button>
              <Button onClick={approve} disabled={launching} className="bg-primary text-primary-foreground hover:bg-ht-teal-hover">
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
