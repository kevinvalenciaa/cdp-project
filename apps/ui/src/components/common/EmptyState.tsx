import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-white px-6 py-16 text-center">
      {/* Same neumorphic plate the dashboard stat glyphs sit on. */}
      <span className="flex size-12 items-center justify-center rounded-lg border border-[#FAFDFF] bg-white text-ht-teal shadow-[0.5px_0.5px_3px_0_rgba(0,0,0,0.15),-4px_-4px_4px_0_rgba(0,0,0,0.02)_inset,2px_2px_4px_0_rgba(0,122,146,0.15)_inset]">
        <Icon className="size-6" aria-hidden />
      </span>
      <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
