"use client";

import { Loader2, Sparkles } from "lucide-react";
import type { Goal } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
    <div className="rounded-xl border border-border bg-card/40 p-4">
      <label htmlFor="goal-input" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        What do you want to grow?
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          id="goal-input"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !running && value.trim()) onRun();
          }}
          placeholder="e.g. Grow second purchases from one-time buyers"
          className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button
          onClick={onRun}
          disabled={running || !value.trim()}
          className="h-10 shrink-0 bg-amber-500 font-medium text-slate-950 hover:bg-amber-400"
        >
          {running ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Running…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" aria-hidden /> Run discovery
            </>
          )}
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {goals.map((g) => (
          <button
            key={g.id}
            onClick={() => onValueChange(g.label)}
            disabled={running}
            className={cn(
              "cursor-pointer rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-50",
              value === g.label
                ? "border-primary/40 bg-primary/15 text-primary"
                : "border-border bg-background/40 text-muted-foreground hover:border-border/80 hover:text-foreground",
            )}
          >
            {g.label}
          </button>
        ))}
      </div>
    </div>
  );
}
