import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TONE_CLASSES, type Tone } from "@/lib/format";

export function StatusPill({ tone = "slate", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
