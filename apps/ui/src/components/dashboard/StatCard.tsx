import type { LucideIcon } from "lucide-react";
import type React from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const ICON_GRADIENT_ID = "pl-stat-icon-gradient";

/**
 * Shared gradient for the stat glyphs. SVG gradients resolve by document-wide
 * id, so this is rendered once per grid rather than once per card - duplicate
 * ids would be invalid markup.
 */
function StatIconGradientDefs() {
  return (
    <svg aria-hidden className="pointer-events-none absolute size-0" focusable="false">
      <defs>
        <linearGradient id={ICON_GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0A9AB5" />
          <stop offset="100%" stopColor="#007A92" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/**
 * The neumorphic plate the glyph sits on: a white tile lit from the top-left,
 * with a brand-tinted inner glow on the opposite corner.
 */
function StatIconPlate({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "rounded-lg border border-[#FAFDFF] bg-white",
        "shadow-[0.5px_0.5px_3px_0_rgba(0,0,0,0.15),-4px_-4px_4px_0_rgba(0,0,0,0.02)_inset,2px_2px_4px_0_rgba(0,122,146,0.15)_inset,8px_9px_7px_0_rgba(0,0,0,0.01),4px_4px_5px_0_rgba(0,0,0,0.01),1px_1px_3px_0_rgba(0,0,0,0.02)]",
        className,
      )}
    />
  );
}

export function StatCardGrid({
  className,
  children,
  ...props
}: { className?: string; children: ReactNode } & Omit<React.ComponentProps<"section">, "className" | "children">) {
  return (
    <section className={cn("relative grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4", className)} {...props}>
      <StatIconGradientDefs />
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  action,
  className,
}: {
  label: string;
  value: string;
  /** Caption beneath the figure - the basis for the number, never dropped. */
  sub?: string;
  icon: LucideIcon;
  action?: ReactNode;
  className?: string;
}) {
  return (
    // `metric-card` carries the shared surface (gradient, radius, border) and is
    // also the hook the layout e2e uses to assert the card radius.
    <div className={cn("metric-card min-h-[76px] min-w-0", className)}>
      <div className="relative flex size-[52px] shrink-0 items-center justify-center">
        <StatIconPlate className="absolute inset-0" />
        <Icon className="relative z-10 size-5" stroke={`url(#${ICON_GRADIENT_ID})`} aria-hidden />
      </div>
      <div className="relative ml-4 min-w-0 grow">
        <h3 className="truncate text-sm font-medium text-neutral-500">{label}</h3>
        <p className="text-xl font-semibold tabular-nums text-gray-900">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </div>
      {action && <div className="absolute bottom-3 right-3">{action}</div>}
    </div>
  );
}
