import type { Opportunity } from "./types";

/**
 * UNIT CONVENTIONS - the codebase carries two, and mixing them is a real bug we shipped once.
 *
 *   FRACTION  0…1        `bandit.*Rate`, and anything from `decisioning`.        → use `pct()`
 *   PERCENT   0…100      `Opportunity.rawConversion`, derived conversion rates.  → use `pctFromPercent()`
 *   POINTS    difference `Opportunity.upliftPp`, `ci`, `measurement.upliftPp`.   → use `pp()`
 *
 * A percentage-POINT difference may only be subtracted from a PERCENT rate - never from a fraction.
 */

/** Format a FRACTION (0…1) as a percentage. `pct(0.1675)` → `"16.8%"`. */
export const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;

/** Format a value already in PERCENT units (0…100). `pctFromPercent(13.068)` → `"13.1%"`. */
export const pctFromPercent = (x: number, d = 1) => `${x.toFixed(d)}%`;

/** Format a percentage-POINT difference. `pp(6.95)` → `"+6.9pp"`. */
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
  if (o.upliftPp == null) return "-";
  const ci = o.ci ? ` · CI [${o.ci[0].toFixed(1)}, ${o.ci[1].toFixed(1)}]` : "";
  const p = o.pValue == null ? "" : ` · p=${o.pValue.toFixed(3)}`;
  return `${pp(o.upliftPp)}${ci}${p}`;
}

/**
 * The holdout (control) conversion rate, in PERCENT units.
 *
 * `rawConversion` is the treatment rate in percent and `upliftPp` is the incremental
 * difference in percentage points, so the control rate is a plain subtraction. Getting
 * this wrong is what produced "Converts 1306.8% vs 1299.9% holdout".
 */
export function controlRate(o: Opportunity): number | null {
  if (o.rawConversion == null || o.upliftPp == null) return null;
  return Math.max(0, o.rawConversion - o.upliftPp);
}

/** A lift is significant when its 95% CI excludes zero. */
export function isSignificant(o: Opportunity): boolean {
  if (!o.ci) return false;
  const [lo, hi] = o.ci;
  return lo > 0 || hi < 0;
}

/**
 * Confidence as a percentage, the way marketers read it - not a p-value.
 * Formats statistical confidence as a concise percentage label.
 */
export function confidenceLabel(o: Opportunity): string | null {
  if (o.pValue == null) return null;
  return `${Math.min(99, Math.floor((1 - o.pValue) * 100))}% confidence`;
}

/** How many times the treatment rate beats the holdout - the headline the chart should state. */
export function liftMultiple(o: Opportunity): number | null {
  const control = controlRate(o);
  if (control == null || control <= 0 || o.rawConversion == null) return null;
  return o.rawConversion / control;
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
  emerald: "bg-ht-green-bg text-ht-green ring-ht-green-border",
  amber: "bg-ht-warning-bg text-ht-warning ring-ht-warning/25",
  rose: "bg-ht-danger-bg text-ht-danger-text ring-ht-danger/25",
  blue: "bg-ht-teal-tint text-ht-teal ring-ht-teal/25",
  slate: "bg-ht-100 text-ht-700 ring-ht-300",
};

/**
 * The arithmetic behind the impact figure, shown so a reader can reconstruct it.
 * Quantum Metric's pattern: never present an estimate without its inputs.
 */
export function impactBasis(o: Opportunity): string | null {
  if (o.upliftPp == null) return null;
  return `${o.reach.toLocaleString()} customers × ${pp(o.upliftPp)} × $${Math.round(o.value)} per conversion`;
}

/** The datasets the agent used (provenance chips). */
export function sourceChips(o: Opportunity): string[] {
  if (o.type === "seasonality") return ["Order history", "Campaign calendar"];
  if (o.type === "segment") return ["Purchase history", "Campaign coverage"];
  return ["Purchase history", "Campaign performance"];
}

/** The draft work the agent already produced. */
export function draftWorkChips(o: Opportunity): string[] {
  return [`${o.reach.toLocaleString()} customers identified`, "Messaging drafted", "Lift measurement configured"];
}
