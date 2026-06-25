"use client";

import { CheckCircle2, Radio, Rocket, TrendingDown, TrendingUp } from "lucide-react";
import type { ActivationSummary, BanditResult, Measurement } from "@/lib/types";
import { pct, pp } from "@/lib/format";
import { StatusPill } from "@/components/common/StatusPill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BanditChart } from "@/components/charts";

const SEGMENTS = ["VIP", "Mid", "Low"];

export function LaunchedView({
  activations,
  measurement,
  bandit,
}: {
  activations: ActivationSummary[];
  measurement: Measurement | null;
  bandit: BanditResult;
}) {
  const treatmentRate = measurement ? measurement.treatmentConv / measurement.treatmentN : 0;
  const controlRate = measurement ? measurement.controlConv / measurement.controlN : 0;
  const positive = (measurement?.upliftPp ?? 0) >= 0;
  const confidence = measurement ? Math.min(99, Math.max(0, Math.round((1 - measurement.pValue) * 100))) : 0;

  return (
    <div className="space-y-8 p-5 lg:p-8">
      {/* Launched campaigns */}
      <section className="space-y-3">
        {activations.map((a) => (
          <div key={a.opportunityKey} className="rounded-xl border border-border bg-card p-4 shadow-ht-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Rocket className="h-4 w-4 text-ht-green" aria-hidden />
                <span className="font-semibold text-foreground">{a.title}</span>
                <StatusPill tone="emerald">
                  <Radio className="h-3 w-3" aria-hidden /> live · measuring
                </StatusPill>
              </div>
              <div className="font-mono text-sm text-ht-green">{pp(a.upliftPp)} lift</div>
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              {a.destination} · {a.audienceSize.toLocaleString()} customers · p={a.pValue.toFixed(3)} · launched {a.launchedAt}
            </div>
          </div>
        ))}
      </section>

      {/* Performance / lift table (AI Decisioning idiom) */}
      {measurement && (
        <section>
          <h2 className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Performance — incremental lift vs holdout</h2>
          <div className="overflow-hidden rounded-xl border border-border shadow-ht-xs">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Goal</TableHead>
                  <TableHead>Winning group</TableHead>
                  <TableHead className="text-right">Holdout</TableHead>
                  <TableHead className="text-right">Treatment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-sm text-foreground">Second-purchase conversion</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
                      Treatment
                      <span className="inline-flex items-center gap-1 text-xs text-ht-green">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> {confidence}% confidence
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-muted-foreground">
                    {pct(controlRate)} <span className="text-xs">Baseline</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center justify-end gap-1.5 font-mono text-sm text-foreground">
                      {pct(treatmentRate)}
                      <span className={`inline-flex items-center gap-0.5 text-xs ${positive ? "text-ht-green" : "text-ht-danger"}`}>
                        {positive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                        {pp(measurement.upliftPp)}
                      </span>
                    </span>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {/* Bandit — best message per segment */}
      <section>
        <h2 className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          AI-Decisioning — best message per segment
        </h2>
        <div className="grid gap-4 rounded-xl border border-border bg-card p-4 shadow-ht-xs md:grid-cols-2">
          <div>
            <div className="grid grid-cols-3 gap-2">
              {bandit.learnedBest.map((v, i) => {
                const optimal = v === bandit.oracleBest[i];
                return (
                  <div key={i} className="rounded-lg border border-border bg-ht-50 p-3 text-sm">
                    <div className="text-xs text-muted-foreground">{SEGMENTS[i] ?? `seg ${i}`}</div>
                    <div className="mt-0.5 truncate font-medium text-foreground">{v}</div>
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
