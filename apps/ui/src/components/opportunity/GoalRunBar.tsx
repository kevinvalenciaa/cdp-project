"use client";

import { Loader2, Sparkles } from "lucide-react";
import type { Goal } from "@/lib/types";
import { cn } from "@/lib/utils";

export function GoalRunBar({
  goals,
  value,
  onValueChange,
  onRun,
  running,
}: {
  goals: Goal[];
  value: string;
  onValueChange: (v: string) => void;
  onRun: () => void;
  running: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-ht-xs">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Optimizing for</span>
        <button
          onClick={onRun}
          disabled={running || !value.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-ht-teal-hover disabled:opacity-50"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
          {running ? "Running…" : "Run discovery"}
        </button>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {goals.map((g) => (
          <button
            key={g.id}
            onClick={() => onValueChange(g.label)}
            disabled={running}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-50",
              value === g.label
                ? "border-primary/30 bg-ht-teal-tint text-ht-teal"
                : "border-border bg-card text-muted-foreground hover:border-ht-400 hover:text-foreground",
            )}
          >
            {g.label}
          </button>
        ))}
      </div>
      <input
        value={goals.some((g) => g.label === value) ? "" : value}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !running && value.trim()) onRun();
        }}
        placeholder="…or describe your own goal"
        aria-label="Custom goal"
        className="mt-2.5 h-9 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>
  );
}
