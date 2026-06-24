import type { Opportunity } from "./types";

export const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;
export const money = (x: number) => `$${Math.round(x).toLocaleString()}`;
export const pp = (x: number) => `${x >= 0 ? "+" : ""}${x.toFixed(1)}pp`;

/** Estimated monthly revenue impact: reach × uplift × value-per-conversion. */
export function monthlyImpact(o: Opportunity): number {
  if (o.upliftPp == null) return 0;
  return Math.max(0, o.reach * (o.upliftPp / 100) * o.value);
}

export function moneyCompact(x: number): string {
  if (x >= 1000) return `$${(x / 1000).toFixed(x >= 10000 ? 0 : 1)}k`;
  return `$${Math.round(x)}`;
}

export function liftLabel(o: Opportunity): string {
  if (o.upliftPp == null) return "—";
  const ci = o.ci ? ` · CI [${o.ci[0].toFixed(1)}, ${o.ci[1].toFixed(1)}]` : "";
  const p = o.pValue == null ? "" : ` · p=${o.pValue.toFixed(3)}`;
  return `${pp(o.upliftPp)}${ci}${p}`;
}

export type Tone = "emerald" | "amber" | "rose" | "blue" | "slate";

export function verdictMeta(verdict: string): { label: string; tone: Tone } {
  switch (verdict) {
    case "real_lift":
      return { label: "proven", tone: "emerald" };
    case "needs_test":
      return { label: "needs a test", tone: "amber" };
    case "explained_by_seasonality":
      return { label: "seasonal", tone: "rose" };
    case "no_significant_lift":
      return { label: "no lift", tone: "rose" };
    default:
      return { label: verdict, tone: "slate" };
  }
}

export const TONE_CLASSES: Record<Tone, string> = {
  emerald: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/25",
  amber: "bg-amber-500/10 text-amber-300 ring-amber-500/25",
  rose: "bg-rose-500/10 text-rose-300 ring-rose-500/25",
  blue: "bg-sky-500/10 text-sky-300 ring-sky-500/25",
  slate: "bg-slate-700/30 text-slate-300 ring-slate-600/40",
};
