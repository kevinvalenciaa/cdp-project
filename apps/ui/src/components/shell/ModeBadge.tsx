import { cn } from "@/lib/utils";

export function ModeBadge({ mode }: { mode: "demo" | "live" }) {
  const live = mode === "live";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1",
        live ? "bg-ht-green-bg text-ht-green ring-ht-green-border" : "bg-ht-teal-tint text-ht-teal ring-primary/20",
      )}
      title={live ? "Live mode — running the real engine" : "Demo mode — deterministic, no API cost"}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", live ? "bg-ht-green" : "bg-ht-teal")} aria-hidden />
      {live ? "Live" : "Demo"} mode
    </span>
  );
}
