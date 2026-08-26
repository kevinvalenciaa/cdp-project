import type { ReactNode } from "react";

import { SidebarTrigger } from "@/components/ui/sidebar";

/**
 * Page header. Sits in the flow of the page rather than as a sticky bar, so the
 * title scrolls away with the content and the inset card keeps one continuous
 * surface. Horizontal padding matches `.app-page` and the bottom gap is left to
 * that container's `gap-6`, so header and body share one rhythm.
 *
 * The trigger is the only way to open the rail below md, where it collapses to
 * a sheet.
 */
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
    <div className="flex flex-col px-6 pt-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-2">
          <SidebarTrigger className="-ml-1 mt-0.5 md:hidden" />
          <div className="min-w-0">
            <h1 className="mb-2 text-2xl font-semibold tracking-[-0.02em] text-foreground">{title}</h1>
            {description && <p className="max-w-3xl text-sm font-medium text-neutral-500">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex items-start gap-3">{actions}</div>}
      </div>
    </div>
  );
}
