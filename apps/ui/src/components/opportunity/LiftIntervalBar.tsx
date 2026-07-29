import { cn } from "@/lib/utils";

export type IntervalTone = "positive" | "negative" | "inconclusive";

export function intervalTone(ci: [number, number] | null | undefined): IntervalTone {
  if (!ci) return "inconclusive";
  const [lo, hi] = ci;
  if (lo > 0) return "positive";
  if (hi < 0) return "negative";
  return "inconclusive";
}

const BAND: Record<IntervalTone, string> = {
  positive: "bg-ht-green",
  negative: "bg-ht-danger",
  inconclusive: "bg-ht-400",
};

const POINT: Record<IntervalTone, string> = {
  positive: "bg-ht-green ring-ht-green-bg",
  negative: "bg-ht-danger ring-ht-danger-bg",
  inconclusive: "bg-ht-600 ring-ht-100",
};

/**
 * The 95% confidence interval for incremental lift, drawn against a vertical zero line.
 *
 * Whether the band crosses zero IS the readout — a marketer never has to be told what
 * p < 0.05 means. Mirrors the "lift interval bar" in Hightouch Campaign Intelligence and
 * Eppo/Datadog Experiments, where an inconclusive result is a first-class grey state
 * rather than a missing number.
 *
 * All values are in percentage POINTS.
 */
export function LiftIntervalBar({
  estimate,
  ci,
  className,
}: {
  estimate: number;
  ci: [number, number] | null;
  className?: string;
}) {
  const tone = intervalTone(ci);
  const [lo, hi] = ci ?? [estimate, estimate];

  // Symmetric domain around zero so the zero line always sits dead centre —
  // an asymmetric axis would visually exaggerate whichever side is longer.
  const reach = Math.max(Math.abs(lo), Math.abs(hi), Math.abs(estimate)) * 1.25 || 1;
  const toPct = (v: number) => ((v + reach) / (2 * reach)) * 100;

  const left = toPct(Math.min(lo, hi));
  const right = toPct(Math.max(lo, hi));

  const label =
    tone === "inconclusive"
      ? `Lift ${estimate >= 0 ? "+" : ""}${estimate.toFixed(1)} percentage points, 95% confidence interval ${lo.toFixed(1)} to ${hi.toFixed(1)}, which overlaps zero — not statistically significant.`
      : `Lift ${estimate >= 0 ? "+" : ""}${estimate.toFixed(1)} percentage points, 95% confidence interval ${lo.toFixed(1)} to ${hi.toFixed(1)}, which excludes zero — statistically significant.`;

  return (
    <div className={cn("w-full", className)}>
      <div className="relative h-9" role="img" aria-label={label}>
        {/* baseline */}
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" aria-hidden />

        {/* the zero line — the only reference that matters */}
        <div className="absolute inset-y-1 left-1/2 w-px -translate-x-1/2 bg-ht-600/50" aria-hidden />

        {/* the interval */}
        <div
          className={cn("absolute top-1/2 h-2 -translate-y-1/2 rounded-full opacity-70", BAND[tone])}
          style={{ left: `${left}%`, width: `${Math.max(right - left, 0.75)}%` }}
          aria-hidden
        />

        {/* the point estimate */}
        <div
          className={cn("absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2", POINT[tone])}
          style={{ left: `${toPct(estimate)}%` }}
          aria-hidden
        />
      </div>

      {/* Labels sit under the values they describe — a justify-between row would park
          "2.8pp" at the far left, where the axis actually reads about -11pp. */}
      <div className="relative h-4 text-[11px] tabular-nums text-muted-foreground" aria-hidden>
        <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${left}%` }}>
          {lo.toFixed(1)}
        </span>
        <span className="absolute left-1/2 -translate-x-1/2 font-medium text-foreground">0</span>
        <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${right}%` }}>
          {hi.toFixed(1)}pp
        </span>
      </div>
    </div>
  );
}
