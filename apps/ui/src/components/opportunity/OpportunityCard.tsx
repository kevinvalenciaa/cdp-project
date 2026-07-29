"use client";

import { Database, FlaskConical, Mail, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Opportunity } from "@/lib/types";
import {
  controlRate,
  draftWorkChips,
  impactBasis,
  liftMultiple,
  moneyCompact,
  monthlyImpact,
  pctFromPercent,
  sourceChips,
} from "@/lib/format";
import { EvidenceBars } from "./EvidenceBars";

const DRAFT_ICONS: LucideIcon[] = [Users, Mail, FlaskConical];

export function OpportunityCard({ opportunity, onOpen }: { opportunity: Opportunity; onOpen: () => void }) {
  const o = opportunity;
  const control = controlRate(o);
  const multiple = liftMultiple(o);
  const bars =
    control != null && o.rawConversion != null
      ? [
          { label: "Holdout", value: control },
          { label: "Treatment", value: o.rawConversion, highlight: true },
        ]
      : [];

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-ht-xs">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[17px] font-semibold leading-snug text-foreground">{o.title}</h3>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="font-medium text-ht-green" title={impactBasis(o) ?? undefined}>
            ~{moneyCompact(monthlyImpact(o))}/mo est. incremental revenue
          </span>
          <span className="text-ht-400" aria-hidden>·</span>
          <span className="text-muted-foreground">{o.reach.toLocaleString()} customers</span>
          <span className="rounded-full bg-ht-100 px-2 py-0.5 text-xs text-ht-700 ring-1 ring-ht-300">{o.segment}</span>
        </div>

        {/* The arithmetic behind the estimate, so a reader can reconstruct it. */}
        {impactBasis(o) && <div className="mt-1 text-xs text-muted-foreground">{impactBasis(o)}</div>}

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-ht-50 p-3.5">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Treatment vs. holdout conversion</div>
            {control != null && o.rawConversion != null && (
              <>
                {/* State the finding, don't just label the chart. */}
                <div className="mt-1 text-sm font-semibold text-foreground">
                  {multiple != null && multiple >= 1.1
                    ? `Converts ${multiple.toFixed(1)}× the holdout`
                    : "Converts above the holdout"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {pctFromPercent(o.rawConversion)} treatment vs {pctFromPercent(control)} holdout
                </div>
              </>
            )}
            <div className="mt-3">
              <EvidenceBars bars={bars} />
            </div>
          </div>
          <div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {o.reason} The audience, messaging, and lift measurement are ready for review.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {sourceChips(o).map((s) => (
                <span key={s} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                  <Database className="h-3 w-3" aria-hidden /> {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-ht-50 px-5 py-3">
        <div className="flex flex-wrap gap-1.5">
          {draftWorkChips(o).map((c, i) => {
            const Icon = DRAFT_ICONS[i] ?? Users;
            return (
              <span key={c} className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] text-ht-700">
                <Icon className="h-3 w-3 text-muted-foreground" aria-hidden /> {c}
              </span>
            );
          })}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onOpen} className="rounded-lg px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted">
            View analysis
          </button>
          <button
            onClick={onOpen}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-ht-teal-hover"
          >
            Review plan
          </button>
        </div>
      </div>
    </div>
  );
}
