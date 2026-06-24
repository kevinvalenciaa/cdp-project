import { cn } from "@/lib/utils";

export function ModeBadge({ mode }: { mode: "demo" | "live" }) {
  const live = mode === "live";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1",
        live ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/25" : "bg-amber-500/10 text-amber-300 ring-amber-500/25",
      )}
      title={live ? "Live mode — running the real engine" : "Demo mode — deterministic, no API cost"}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", live ? "bg-emerald-400" : "bg-amber-400")} aria-hidden />
      {live ? "Live" : "Demo"} mode
    </span>
  );
}
