"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { BookOpen, Loader2, MessageSquareText, PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { InvestigationSummary } from "@/lib/investigations";
import { BOTTOM_ITEMS, NAV_GROUPS, type NavItem } from "./nav-items";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function NavLink({
  item,
  onNavigate,
  collapsed = false,
}: {
  item: NavItem;
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        "group flex items-center rounded-md text-[13px] transition-colors",
        collapsed ? "justify-center px-0 py-2" : "gap-2.5 px-2.5 py-1.5",
        active
          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-sidebar-primary" : "text-sidebar-foreground/55")} aria-hidden />
      {!collapsed && item.label}
    </Link>
  );
}

export function AppSidebar({
  onNavigate,
  onToggleSidebar,
  collapsed = false,
}: {
  onNavigate?: () => void;
  onToggleSidebar?: () => void;
  collapsed?: boolean;
}) {
  const [investigations, setInvestigations] = useState<InvestigationSummary[]>([]);

  useEffect(() => {
    if (collapsed) return;
    let active = true;
    fetch("/api/investigations?status=active&limit=10", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { investigations: [] }))
      .then((payload: { investigations?: InvestigationSummary[] }) => {
        if (active) setInvestigations(payload.investigations ?? []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [collapsed]);

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className={cn("flex items-center pb-3 pt-4", collapsed ? "justify-center px-2" : "justify-between px-4")}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <span className="h-5 w-5 rounded-[5px] bg-ht-green-accent" aria-hidden />
            <span className="text-[15px] font-semibold tracking-tight text-sidebar-foreground">Hightouch</span>
          </div>
        )}
        {onToggleSidebar && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            onClick={onToggleSidebar}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        )}
      </div>

      <WorkspaceSwitcher collapsed={collapsed} />

      <div className={cn(collapsed ? "px-2 pb-2" : "px-3 pb-2")}>
        <Link
          href="/opportunities/new"
          onClick={onNavigate}
          aria-label={collapsed ? "New investigation" : undefined}
          title={collapsed ? "New investigation" : undefined}
          className={cn(
            "flex items-center rounded-md bg-sidebar-primary text-[13px] font-medium text-sidebar-primary-foreground transition-opacity hover:opacity-90",
            collapsed ? "h-9 justify-center px-0" : "gap-2 px-2.5 py-2",
          )}
        >
          <Plus className="h-4 w-4 shrink-0" aria-hidden />
          {!collapsed && "New investigation"}
        </Link>
      </div>

      <nav className={cn("flex-1 space-y-4 overflow-y-auto py-2", collapsed ? "px-2" : "px-3")} aria-label="Primary">
        {NAV_GROUPS.map((group, i) => (
          <div key={group.label ?? `g${i}`} className="space-y-0.5">
            {group.label && !collapsed && (
              <div className="px-2.5 pb-1 pt-1 text-[11px] font-medium uppercase tracking-wider text-sidebar-foreground/40">
                {group.label}
              </div>
            )}
            {group.items.map((item) => (
              <NavLink key={item.href} item={item} onNavigate={onNavigate} collapsed={collapsed} />
            ))}
          </div>
        ))}
        {!collapsed && investigations.length > 0 && (
          <div className="space-y-0.5">
            <div className="flex items-center justify-between px-2.5 pb-1 pt-1">
              <span className="text-[11px] font-medium uppercase tracking-wider text-sidebar-foreground/40">
                Recent investigations
              </span>
              {investigations.some((item) => item.activeRunStatus) && (
                <Loader2 className="h-3 w-3 animate-spin text-sidebar-foreground/40" aria-hidden />
              )}
            </div>
            {investigations.map((investigation) => (
              <Link
                key={investigation.id}
                href={`/opportunities/${investigation.id}`}
                onClick={onNavigate}
                className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              >
                <MessageSquareText className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/45" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{investigation.title}</span>
                {investigation.activeRunStatus && (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ht-green-accent" aria-label={investigation.activeRunStatus} />
                )}
              </Link>
            ))}
            <Link
              href="/opportunities/investigations"
              onClick={onNavigate}
              className="block px-2.5 pt-1 text-[11px] text-sidebar-foreground/45 hover:text-sidebar-foreground"
            >
              View all investigations
            </Link>
          </div>
        )}
      </nav>

      <div className={cn("space-y-0.5 border-t border-sidebar-border", collapsed ? "p-2" : "p-3")}>
        {BOTTOM_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} onNavigate={onNavigate} collapsed={collapsed} />
        ))}
        <Link
          href="/how-it-works"
          onClick={onNavigate}
          aria-label={collapsed ? "Docs & support" : undefined}
          title={collapsed ? "Docs & support" : undefined}
          className={cn(
            "flex items-center rounded-md text-[13px] text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
            collapsed ? "justify-center px-0 py-2" : "gap-2.5 px-2.5 py-1.5",
          )}
        >
          <BookOpen className="h-4 w-4 text-sidebar-foreground/55" aria-hidden />
          {!collapsed && "Docs & support"}
        </Link>
        <div
          className={cn("mt-1 flex items-center", collapsed ? "justify-center px-0 py-1.5" : "gap-2.5 px-2.5 py-1.5")}
          title={collapsed ? "maria@fashionretailer.com" : undefined}
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ht-green-accent/20 text-[11px] font-semibold text-ht-green-accent">
            M
          </span>
          {!collapsed && (
            <span className="truncate text-[12px] text-sidebar-foreground/60">maria@fashionretailer.com</span>
          )}
        </div>
      </div>
    </div>
  );
}
