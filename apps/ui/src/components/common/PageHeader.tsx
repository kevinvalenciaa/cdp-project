import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex min-h-24 flex-wrap items-center justify-between gap-5 border-b border-border bg-card/70 px-5 py-6 backdrop-blur sm:px-6 lg:px-8">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-[-0.025em] text-foreground">{title}</h1>
        {description && <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
