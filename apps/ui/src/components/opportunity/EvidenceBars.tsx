import { cn } from "@/lib/utils";

export interface EvidenceBar {
  label: string;
  value: number;
  highlight?: boolean;
}

/** Hightouch's "evidence glance" — a tiny bar chart with exactly one highlighted bar. */
export function EvidenceBars({ bars }: { bars: EvidenceBar[] }) {
  const max = Math.max(...bars.map((b) => b.value), 0.0001);
  const label = bars.map((b) => `${b.label} ${b.value.toFixed(1)} percent`).join(", ");
  return (
    <div className="flex items-end gap-3" role="img" aria-label={`Conversion rate: ${label}.`}>
      {bars.map((b) => (
        <div key={b.label} className="flex flex-1 flex-col items-center gap-1.5">
          <div className="flex h-16 w-full items-end justify-center">
            <div
              className={cn("w-full max-w-[40px] rounded-t-[3px]", b.highlight ? "bg-ht-green" : "bg-ht-300")}
              style={{ height: `${Math.max(8, (b.value / max) * 100)}%` }}
            />
          </div>
          <span className="text-[10px] leading-none text-muted-foreground">{b.label}</span>
        </div>
      ))}
    </div>
  );
}
