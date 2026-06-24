"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Rocket, Send, Users } from "lucide-react";
import type { ActivationEvent, ActivationResult, Opportunity } from "@/lib/types";
import { liftLabel, money, monthlyImpact, pct, verdictMeta } from "@/lib/format";
import { useEventStream } from "@/lib/use-event-stream";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
  const control = o.rawConversion != null && o.upliftPp != null ? o.rawConversion - o.upliftPp / 100 : null;
  const vm = verdictMeta(o.verdict);
  const launching = status === "streaming";

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto border-border bg-background p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border px-6 py-5 text-left">
          <div className="flex items-center gap-2">
            <StatusPill tone={o.accepted ? "emerald" : vm.tone}>{o.accepted ? "proven" : vm.label}</StatusPill>
            {o.accepted && <span className="font-mono text-sm text-emerald-300">{money(monthlyImpact(o))}/mo est. impact</span>}
          </div>
          <SheetTitle className="mt-2 text-lg text-foreground">{o.title}</SheetTitle>
          <p className="text-sm text-muted-foreground">{o.segment}</p>
        </SheetHeader>

        <div className="space-y-6 px-6 py-5">
          {/* Evidence */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Why this {o.accepted ? "works" : "was rejected"}</h3>
            <p className="mt-2 text-sm text-slate-300">{o.reason}</p>
            {control != null && o.rawConversion != null && (
              <div className="mt-3 rounded-lg border border-border bg-card/40 p-3">
                <TreatmentControlBar treatmentRate={o.rawConversion} controlRate={Math.max(0, control)} />
                <div className="mt-1 text-center text-sm">
                  <StatusPill tone={o.accepted ? "emerald" : "rose"}>lift {liftLabel(o)}</StatusPill>
                </div>
              </div>
            )}
            {o.accepted && (
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-emerald-300">
                <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> proven with a holdout</span>
                <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> not seasonal</span>
                <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> not a trap</span>
              </div>
            )}
            {!o.accepted && o.bareLlm && (
              <div className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/[0.06] p-3 text-xs text-slate-300">
                A bare LLM would <span className="text-rose-300">accept</span> this: “{o.bareLlm.reason}” — the Verifier rejected it.
              </div>
            )}
          </section>

          {/* Draft work + activation (accepted only) */}
          {o.accepted && activation && (
            <section className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Draft work</h3>
              <div className="rounded-lg border border-border bg-card/40 p-3 text-sm">
                <div className="flex items-center gap-2 text-slate-200">
                  <Users className="h-4 w-4 text-muted-foreground" aria-hidden />
                  {activation.audience.label}
                </div>
                <div className="mt-1 text-muted-foreground">
                  reach {activation.audience.reach.toLocaleString()} ·{" "}
                  <span className="text-emerald-300">{activation.audience.persuadableReach.toLocaleString()} persuadable</span> ·{" "}
                  {activation.audience.channel}
                </div>
              </div>
              <div className="space-y-2">
                {activation.variants.map((v) => (
                  <div key={v.id} className="rounded-lg border border-border bg-card/40 p-3 text-sm text-slate-200">
                    <span className="mr-2 font-mono text-xs text-muted-foreground">{v.id}</span>
                    {v.text}
                  </div>
                ))}
                <StatusPill tone="emerald">
                  <CheckCircle2 className="h-3 w-3" aria-hidden /> guardrail clear
                </StatusPill>
              </div>

              {/* Activation progress / result */}
              {launching && (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-card/40 p-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  {lastStep?.label ?? "Launching…"}
                </div>
              )}
              {result && (
                <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] p-3 text-sm">
                  <div className="flex items-center gap-1.5 text-emerald-300">
                    <Rocket className="h-4 w-4" aria-hidden /> Launched to {result.sync?.destination} <span className="text-muted-foreground">(simulated)</span>
                  </div>
                  <div className="mt-1.5 text-slate-300">
                    Measured: treatment {result.measurement.treatmentConv}/{result.measurement.treatmentN} vs control{" "}
                    {result.measurement.controlConv}/{result.measurement.controlN} →{" "}
                    <span className="font-medium text-emerald-300">
                      {result.measurement.upliftPp >= 0 ? "+" : ""}
                      {result.measurement.upliftPp.toFixed(1)}pp
                    </span>{" "}
                    (p={result.measurement.pValue.toFixed(3)})
                  </div>
                </div>
              )}
            </section>
          )}
        </div>

        {/* Footer actions */}
        <div className="mt-auto flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          {o.accepted && !result ? (
            <>
              <Button variant="ghost" onClick={() => handleOpenChange(false)}>
                Dismiss
              </Button>
              <Button onClick={approve} disabled={launching} className="bg-amber-500 font-medium text-slate-950 hover:bg-amber-400">
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
