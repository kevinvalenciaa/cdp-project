"use client";

import { CheckCircle2, Radio, Rocket } from "lucide-react";
import type { ActivationSummary, BanditResult, Measurement } from "@/lib/types";
import { pct, pp } from "@/lib/format";
import { StatusPill } from "@/components/common/StatusPill";
import { BanditChart, TreatmentControlBar } from "@/components/charts";

const SEGMENTS = ["vip", "mid", "low"];

export function LaunchedView({
  activations,
  measurement,
  bandit,
}: {
  activations: ActivationSummary[];
  measurement: Measurement | null;
  bandit: BanditResult;
}) {
  return (
    <div className="space-y-8 p-5 lg:p-8">
      <section className="space-y-3">
        {activations.map((a) => (
          <div key={a.opportunityKey} className="rounded-xl border border-emerald-500/20 bg-card/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Rocket className="h-4 w-4 text-emerald-400" aria-hidden />
                <span className="font-semibold text-foreground">{a.title}</span>
                <StatusPill tone="emerald">
                  <Radio className="h-3 w-3" aria-hidden /> live · measuring
                </StatusPill>
              </div>
              <div className="font-mono text-sm text-emerald-300">{pp(a.upliftPp)} lift</div>
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              {a.destination} · {a.audienceSize.toLocaleString()} customers · p={a.pValue.toFixed(3)} · launched {a.launchedAt}
            </div>
          </div>
        ))}

        {measurement && (
          <div className="grid gap-4 rounded-xl border border-border bg-card/40 p-4 md:grid-cols-2">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Incremental lift vs holdout</h3>
              <div className="mt-2">
                <TreatmentControlBar
                  treatmentRate={measurement.treatmentConv / measurement.treatmentN}
                  controlRate={measurement.controlConv / measurement.controlN}
                />
              </div>
            </div>
            <div className="flex flex-col justify-center">
              <div className="font-mono text-3xl font-semibold text-emerald-300">{pp(measurement.upliftPp)}</div>
              <p className="mt-1 text-sm text-muted-foreground">
                treatment {measurement.treatmentConv}/{measurement.treatmentN} vs control {measurement.controlConv}/{measurement.controlN} · p=
                {measurement.pValue.toFixed(3)}
              </p>
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          AI-Decisioning — best message per segment
        </h2>
        <div className="grid gap-4 rounded-xl border border-border bg-card/40 p-4 md:grid-cols-2">
          <div>
            <div className="grid grid-cols-3 gap-2">
              {bandit.learnedBest.map((v, i) => {
                const optimal = v === bandit.oracleBest[i];
                return (
                  <div key={i} className="rounded-lg bg-background/50 p-3 text-sm">
                    <div className="text-xs text-muted-foreground">{SEGMENTS[i] ?? `seg ${i}`}</div>
                    <div className="mt-0.5 truncate font-medium text-slate-200">{v}</div>
                    <StatusPill tone={optimal ? "emerald" : "rose"} className="mt-1.5">
                      {optimal ? (
                        <>
                          <CheckCircle2 className="h-3 w-3" /> optimal
                        </>
                      ) : (
                        "off"
                      )}
                    </StatusPill>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusPill tone="blue">+{(bandit.liftVsHoldout * 100).toFixed(1)}% vs holdout</StatusPill>
              <StatusPill tone="blue">+{(bandit.liftVsGlobalBest * 100).toFixed(1)}% vs human marketing</StatusPill>
            </div>
          </div>
          <div>
            <BanditChart bandit={bandit} />
            <p className="mt-1 text-center text-xs text-muted-foreground">
              bandit {pct(bandit.banditRate)} · oracle {pct(bandit.oracleRate)} · random {pct(bandit.randomRate)}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
