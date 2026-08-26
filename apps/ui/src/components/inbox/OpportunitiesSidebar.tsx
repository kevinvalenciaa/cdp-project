"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Loader2, MessageSquareText, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { InvestigationSummary } from "@/lib/investigations";
import { usePersistedToggle } from "@/lib/use-persisted-toggle";
import { cn } from "@/lib/utils";

export function OpportunitiesSidebar({ investigations }: { investigations: InvestigationSummary[] }) {
  const pathname = usePathname();
  const [sidebarOpen, toggleSidebar] = usePersistedToggle("ui.opportunities-sidebar-open", true);
  const hasActiveRun = investigations.some((investigation) => investigation.activeRunStatus);

  function renderLinks(collapsed = false) {
    return (
      <nav className="space-y-1" aria-label="Recent investigation links">
      {investigations.map((investigation) => {
        const href = `/investigations/${investigation.id}`;
        const active = pathname === href;
        return (
          <Link
            key={investigation.id}
            href={href}
            aria-current={active ? "page" : undefined}
            aria-label={collapsed ? investigation.title : undefined}
            title={collapsed ? investigation.title : undefined}
            className={cn(
              "relative flex items-center rounded-xl text-[12px] transition-colors",
              collapsed ? "h-10 justify-center px-0" : "gap-2.5 px-3 py-2.5",
              active
                ? "bg-ht-teal-tint font-medium text-ht-teal"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <MessageSquareText
              className={cn("h-3.5 w-3.5 shrink-0", active ? "text-ht-teal" : "text-muted-foreground/70")}
              aria-hidden
            />
            {!collapsed && <span className="min-w-0 flex-1 truncate">{investigation.title}</span>}
            {investigation.activeRunStatus && (
              <span
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full bg-ht-green-accent",
                  collapsed && "absolute right-2 top-2",
                )}
                aria-label={investigation.activeRunStatus}
              />
            )}
          </Link>
        );
      })}
    </nav>
    );
  }

  return (
    <>
      <aside
        aria-label="Recent investigations"
        className={cn(
          "sticky top-0 hidden h-[calc(100dvh-5rem)] shrink-0 border-r border-border bg-card/45 transition-[width] duration-200 ease-out xl:block",
          sidebarOpen ? "w-[232px]" : "w-16",
        )}
      >
        <div className={cn("h-full overflow-y-auto py-6", sidebarOpen ? "px-3" : "px-2")}>
          <div className={cn("flex items-center pb-2", sidebarOpen ? "justify-between px-3" : "justify-center")}>
            {sidebarOpen && (
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                Recent investigations
              </span>
            )}
            <div className="flex items-center gap-1">
              {sidebarOpen && hasActiveRun && (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" aria-hidden />
              )}
              <button
                type="button"
                onClick={toggleSidebar}
                aria-label={sidebarOpen ? "Collapse recent investigations" : "Expand recent investigations"}
                aria-expanded={sidebarOpen}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                {sidebarOpen ? (
                  <PanelLeftClose className="h-4 w-4" aria-hidden />
                ) : (
                  <PanelLeftOpen className="h-4 w-4" aria-hidden />
                )}
              </button>
            </div>
          </div>
          {renderLinks(!sidebarOpen)}
        </div>
      </aside>

      <details className="group border-b border-border bg-card/60 xl:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:px-6">
          <span className="flex items-center gap-2">
            Recent investigations
            {hasActiveRun && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
          </span>
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="border-t border-border px-3 py-3 sm:px-4">{renderLinks()}</div>
      </details>
    </>
  );
}
