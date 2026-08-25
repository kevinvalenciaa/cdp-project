"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
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
        "group flex items-center rounded-xl text-[13px] transition-colors",
        collapsed ? "h-10 justify-center px-0" : "gap-3 px-3 py-2.5",
        active
          ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
      )}
    >
      <Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-sidebar-primary" : "text-sidebar-foreground/55")} aria-hidden />
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
      <div className={cn("flex h-20 items-center", collapsed ? "justify-center px-2" : "justify-between px-5")}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <span className="h-7 w-7 rounded-[9px] bg-primary shadow-ht-xs" aria-hidden />
            <span className="text-[16px] font-semibold tracking-[-0.02em] text-foreground">Proofloop</span>
          </div>
        )}
        {onToggleSidebar && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            onClick={onToggleSidebar}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        )}
      </div>

      <WorkspaceSwitcher collapsed={collapsed} />

      <div className={cn(collapsed ? "px-3 pb-3" : "px-4 pb-3")}>
        <Link
          href="/investigations"
          onClick={onNavigate}
          aria-label={collapsed ? "New investigation" : undefined}
          title={collapsed ? "New investigation" : undefined}
          className={cn(
            "flex items-center rounded-xl bg-sidebar-primary text-[13px] font-semibold text-sidebar-primary-foreground shadow-ht-xs transition-all hover:-translate-y-px hover:opacity-90",
            collapsed ? "h-10 justify-center px-0" : "gap-2.5 px-3 py-2.5",
          )}
        >
          <Plus className="h-4 w-4 shrink-0" aria-hidden />
          {!collapsed && "New investigation"}
        </Link>
      </div>

      <nav className={cn("flex-1 space-y-5 overflow-y-auto py-2", collapsed ? "px-3" : "px-4")} aria-label="Primary">
        {NAV_GROUPS.map((group, i) => (
          <div key={group.label ?? `g${i}`} className="space-y-1">
            {group.label && !collapsed && (
              <div className="px-3 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/45">
                {group.label}
              </div>
            )}
            {group.items.map((item) => (
              <NavLink key={item.href} item={item} onNavigate={onNavigate} collapsed={collapsed} />
            ))}
          </div>
        ))}
      </nav>

      <div className={cn("space-y-1 border-t border-sidebar-border", collapsed ? "p-3" : "p-4")}>
        {BOTTOM_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} onNavigate={onNavigate} collapsed={collapsed} />
        ))}
        <Link
          href="/how-it-works"
          onClick={onNavigate}
          aria-label={collapsed ? "Docs & support" : undefined}
          title={collapsed ? "Docs & support" : undefined}
          className={cn(
            "flex items-center rounded-xl text-[13px] text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            collapsed ? "h-10 justify-center px-0" : "gap-3 px-3 py-2.5",
          )}
        >
          <BookOpen className="h-4 w-4 text-sidebar-foreground/55" aria-hidden />
          {!collapsed && "Docs & support"}
        </Link>
        <div
          className={cn("mt-1 flex items-center", collapsed ? "justify-center px-0 py-2" : "gap-3 px-3 py-2.5")}
          title={collapsed ? "maria@fashionretailer.com" : undefined}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ht-teal-tint text-[11px] font-semibold text-ht-teal">
            M
          </span>
          {!collapsed && (
            <span className="truncate text-[12px] text-sidebar-foreground/65">maria@fashionretailer.com</span>
          )}
        </div>
      </div>
    </div>
  );
}
