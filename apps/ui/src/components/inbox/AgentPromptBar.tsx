"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { ArrowUp, Loader2, Sparkles } from "lucide-react";
import type { Goal } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The agent chat input — the single place a marketer states intent. Adapted
 * from the reference ai-prompt-box to this app's design system (light theme,
 * ht tokens) and to this product's reality: the contextual actions are GOAL
 * PRESETS, not generic search/think toggles, and there is no mic/upload —
 * controls that do nothing are noise in a portfolio product.
 */
export function AgentPromptBar({
  goals,
  running,
  onSend,
  autoFocus,
}: {
  goals: Goal[];
  running: boolean;
  onSend: (goal: string) => void;
  autoFocus?: boolean;
}) {
  const [value, setValue] = React.useState("");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Auto-grow up to ~5 lines, then scroll.
  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const hasContent = value.trim().length > 0;

  const submit = React.useCallback(() => {
    const goal = value.trim();
    if (!goal || running) return;
    onSend(goal);
    setValue("");
  }, [value, running, onSend]);

  return (
    <TooltipPrimitive.Provider delayDuration={300}>
      <div
        className={cn(
          "rounded-2xl border border-border bg-card p-2 shadow-ht-sm transition-all duration-300",
          running && "border-primary/40 shadow-[0_0_0_3px_rgba(0,124,124,0.08)]",
        )}
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          disabled={running}
          placeholder={running ? "Agents are working…" : "What should the agents optimize? e.g. Grow second purchases from one-time buyers"}
          aria-label="Describe a marketing goal for the agents"
          className="min-h-[44px] w-full resize-none border-none bg-transparent px-3 py-2.5 text-[15px] text-foreground placeholder:text-muted-foreground focus-visible:outline-none disabled:opacity-60"
        />

        <div className="flex items-end justify-between gap-2 pt-1.5">
          {/* Goal presets — the product's version of the reference's mode toggles. */}
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 pl-1">
            {goals.map((g) => {
              const active = value === g.label;
              return (
                <button
                  key={g.id}
                  type="button"
                  disabled={running}
                  onClick={() => {
                    setValue(active ? "" : g.label);
                    textareaRef.current?.focus();
                  }}
                  className={cn(
                    "truncate rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-50",
                    active
                      ? "border-primary/30 bg-ht-teal-tint text-ht-teal"
                      : "border-transparent bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {g.label}
                </button>
              );
            })}
          </div>

          <TooltipPrimitive.Root>
            <TooltipPrimitive.Trigger asChild>
              <button
                type="button"
                onClick={submit}
                disabled={running || !hasContent}
                aria-label={running ? "Agents are working" : "Run discovery"}
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200",
                  running
                    ? "bg-muted text-muted-foreground"
                    : hasContent
                      ? "bg-primary text-primary-foreground hover:bg-ht-teal-hover"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {running ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : hasContent ? (
                  <ArrowUp className="h-4 w-4" aria-hidden />
                ) : (
                  <Sparkles className="h-4 w-4" aria-hidden />
                )}
              </button>
            </TooltipPrimitive.Trigger>
            <TooltipPrimitive.Content
              side="top"
              sideOffset={6}
              className="z-50 rounded-md border border-border bg-popover px-2.5 py-1 text-xs text-popover-foreground shadow-ht-sm"
            >
              {running ? "Agents are working…" : hasContent ? "Run discovery (Enter)" : "Describe a goal first"}
            </TooltipPrimitive.Content>
          </TooltipPrimitive.Root>
        </div>
      </div>
    </TooltipPrimitive.Provider>
  );
}
