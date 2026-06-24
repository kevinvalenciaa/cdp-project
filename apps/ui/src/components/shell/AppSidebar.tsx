"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Sidebar content — used in both the desktop rail and the mobile Sheet. */
export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/25">
          <Compass className="h-5 w-5" aria-hidden />
        </span>
        <div className="leading-tight">
          <div className="font-semibold text-sidebar-foreground">Lift Compass</div>
          <div className="font-mono text-[11px] text-muted-foreground">Agentic CDP</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3" aria-label="Primary">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <Link
          href="/how-it-works"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
        >
          <BookOpen className="h-4 w-4" aria-hidden />
          How it works
        </Link>
      </div>
    </div>
  );
}
