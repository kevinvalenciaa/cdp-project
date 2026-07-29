"use client";

import type { Opportunity } from "@/lib/types";
import { pctFromPercent, verdictMeta } from "@/lib/format";
import { StatusPill } from "@/components/common/StatusPill";
import { intervalTone } from "./LiftIntervalBar";

/** One line naming the statistical reason a candidate did not survive, in plain language. */
function ruledOutBecause(o: Opportunity): string | null {
  if (o.verdict === "explained_by_seasonality") return "Movement matched the seasonal baseline.";
  if (o.verdict === "needs_test") return "No holdout has run yet — nothing to measure against.";
  if (o.ci && intervalTone(o.ci) === "inconclusive") {
    return `95% CI [${o.ci[0].toFixed(1)}, ${o.ci[1].toFixed(1)}] overlaps 0%.`;
  }
  return null;
}

/**
 * What the agents analysed and ruled out.
 *
 * Showing the rejected search space — not just the winners — is what makes the Verifier
 * legible as a working component rather than a claim. Mirrors Fullstory's "unlikely factors".
 */
export function RejectedList({ rejected, onOpen }: { rejected: Opportunity[]; onOpen: (o: Opportunity) => void }) {
  if (rejected.length === 0) return null;
  return (
    <section>
      <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Analysed and ruled out · {rejected.length}
      </h2>
      <p className="mb-3 mt-1 text-xs text-muted-foreground">
        These cleared the first pass but failed verification. Several convert well on raw numbers — none of them caused
        the conversion.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {rejected.map((o) => {
          const m = verdictMeta(o.verdict);
          const because = ruledOutBecause(o);
          return (
            <button
              key={o.key}
              onClick={() => onOpen(o)}
              className="rounded-lg border border-border bg-card p-3 text-left shadow-ht-xs transition-colors hover:border-ht-400"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-foreground">{o.title}</span>
                <StatusPill tone={m.tone}>{m.label}</StatusPill>
              </div>

              {/* The tension the Verifier resolved: high raw conversion, no incremental lift. */}
              {o.rawConversion != null && (
                <div className="mt-1 text-xs text-muted-foreground">
                  <span className="tabular-nums text-foreground">{pctFromPercent(o.rawConversion)}</span> raw conversion
                </div>
              )}

              {because && <p className="mt-1 text-xs tabular-nums text-muted-foreground">{because}</p>}
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{o.reason}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
