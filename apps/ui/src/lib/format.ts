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
  emerald: "bg-ht-green-bg text-ht-green ring-ht-green-border",
  amber: "bg-ht-warning-bg text-ht-warning ring-ht-warning/25",
  rose: "bg-ht-danger-bg text-ht-danger-text ring-ht-danger/25",
  blue: "bg-ht-teal-tint text-ht-teal ring-ht-teal/25",
  slate: "bg-ht-100 text-ht-700 ring-ht-300",
};

/** Hightouch-style "$X estimated incremental revenue". */
export function impactLabel(o: Opportunity): string {
  return `${moneyCompact(monthlyImpact(o))}/mo estimated incremental revenue`;
}

/** Deterministic "Found at H:MM AM" timestamp from the opportunity key. */
export function foundAt(key: string): string {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const hour = 1 + (h % 5);
  const min = h % 60;
  return `Found at ${hour}:${String(min).padStart(2, "0")} AM`;
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
