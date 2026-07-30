"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
