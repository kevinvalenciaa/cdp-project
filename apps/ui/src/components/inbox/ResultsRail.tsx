"use client";

import { CheckCircle2, Circle, ShieldAlert, ShieldCheck, Sparkles } from "lucide-react";
import type { Opportunity, RunDetail } from "@/lib/types";
import { confidenceLabel, isSignificant, moneyCompact, monthlyImpact, pctFromPercent, pp, verdictMeta } from "@/lib/format";
import { StatusPill } from "@/components/common/StatusPill";

/**
 * The artifact panel beside the conversation: what the agents PROVED (ranked
 * by impact), what they CAUGHT before it cost money (the verifier's saves),
 * and everything else they analysed and ruled out. The rail is the receipt;
 * the chat is how you asked for it.
 */

/** What a naive read of raw conversion would have claimed this was worth. */
function naiveClaimedImpact(o: Opportunity): number {
  if (o.rawConversion == null) return 0;
  return Math.max(0, o.reach * (o.rawConversion / 100) * o.value);
}

export function ResultsRail({
  run,
  onOpen,
}: {
  run: RunDetail | null;
  onOpen: (o: Opportunity) => void;
}) {
  const ranked = [...(run?.opportunities.ranked ?? [])].sort((a, b) => monthlyImpact(b) - monthlyImpact(a));
  const rejected = run?.opportunities.rejected ?? [];
  // "Caught" = the verifier rejected it while a generic AI approved it.
  const caught = rejected.filter((o) => o.bareLlm?.accepted);
  const ruledOut = rejected.filter((o) => !o.bareLlm?.accepted);

  const totalImpact = ranked.reduce((s, o) => s + monthlyImpact(o), 0);
  const totalSaved = caught.reduce((s, o) => s + naiveClaimedImpact(o), 0);
  const runCost = run?.costUsd;

  if (!run) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Results will appear here after the first discovery run.
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 lg:p-5">
      {/* The triad the page ranks by: impact · cost · caught-before-it-cost-you. */}
      <div className="grid grid-cols-3 divide-x divide-border overflow-hidden rounded-2xl border border-border bg-background">
        <RailStat label="Est. impact" value={`~${moneyCompact(totalImpact)}/mo`} tone="text-ht-green" />
        <RailStat label="Run cost" value={runCost != null ? `$${runCost.toFixed(2)}` : "-"} tone="text-foreground" />
        <RailStat label="Saved" value={totalSaved > 0 ? `~${moneyCompact(totalSaved)}/mo` : "-"} tone="text-ht-danger-text" />
      </div>

      {/* Proven, ranked by impact */}
      <section aria-label="Proven opportunities">
        <SectionHead icon={<Sparkles className="h-3.5 w-3.5 text-ht-teal" aria-hidden />}>
          Proven - ranked by impact
        </SectionHead>
        <ol className="mt-2 space-y-2">
          {ranked.map((o, i) => (
            <li key={o.key}>
              <button
                onClick={() => onOpen(o)}
                className="w-full rounded-2xl border border-border bg-card px-4 py-3.5 text-left shadow-ht-xs transition-all hover:-translate-y-px hover:border-ht-400 hover:shadow-ht-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">#{i + 1}</span>
                    <span className="truncate text-sm font-medium text-foreground">{o.title}</span>
                  </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-ht-green">
                    ~{moneyCompact(monthlyImpact(o))}/mo
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2 pl-6 text-xs text-muted-foreground">
                  {o.upliftPp != null && <span className="tabular-nums">{pp(o.upliftPp)} lift</span>}
                  {confidenceLabel(o) && (
                    <span className={`inline-flex items-center gap-1 ${isSignificant(o) ? "text-ht-green" : ""}`}>
                      {isSignificant(o) ? <CheckCircle2 className="h-3 w-3" aria-hidden /> : <Circle className="h-3 w-3" aria-hidden />}
                      {confidenceLabel(o)}
                    </span>
                  )}
                  <span className="tabular-nums">reach {o.reach.toLocaleString()}</span>
                </div>
              </button>
            </li>
          ))}
          {ranked.length === 0 && <Empty>No proven opportunities in this run.</Empty>}
        </ol>
      </section>

      {/* The verifier's saves */}
      <section aria-label="Caught before it cost you">
        <SectionHead icon={<ShieldAlert className="h-3.5 w-3.5 text-ht-danger" aria-hidden />}>
          Caught before it cost you
        </SectionHead>
        <ul className="mt-2 space-y-2">
          {caught.map((o) => (
            <li key={o.key}>
              <button
                onClick={() => onOpen(o)}
                className="w-full rounded-2xl border border-ht-danger/20 bg-ht-danger-bg/40 px-4 py-3.5 text-left transition-colors hover:border-ht-danger/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-foreground">{o.title}</span>
                  {naiveClaimedImpact(o) > 0 && (
                    <span className="shrink-0 font-mono text-xs tabular-nums text-ht-danger-text">
                      claimed ~{moneyCompact(naiveClaimedImpact(o))}/mo
                    </span>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {o.rawConversion != null && <>{pctFromPercent(o.rawConversion)} raw conversion - </>}
                  {o.reason}
                </p>
              </button>
            </li>
          ))}
          {caught.length === 0 && <Empty>No traps in this run.</Empty>}
        </ul>
      </section>

      {/* Everything else the agents analysed and ruled out */}
      <section aria-label="Analysed and ruled out">
        <SectionHead icon={<ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />}>
          Analysed &amp; ruled out
        </SectionHead>
        <ul className="mt-2 space-y-1.5">
          {ruledOut.map((o) => {
            const m = verdictMeta(o.verdict);
            return (
              <li key={o.key}>
                <button
                  onClick={() => onOpen(o)}
                  className="flex w-full items-center justify-between gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-left shadow-ht-xs transition-colors hover:border-ht-400"
                >
                  <span className="truncate text-sm text-foreground">{o.title}</span>
                  <StatusPill tone={m.tone}>{m.label}</StatusPill>
                </button>
              </li>
            );
          })}
          {ruledOut.length === 0 && <Empty>Nothing else was ruled out.</Empty>}
        </ul>
      </section>
    </div>
  );
}

function RailStat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="px-3 py-3">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 truncate text-sm font-semibold tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}

function SectionHead({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {icon}
      {children}
    </h2>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <li className="rounded-2xl border border-dashed border-border px-4 py-3.5 text-xs text-muted-foreground">{children}</li>;
}
