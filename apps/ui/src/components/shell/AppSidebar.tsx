"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ChevronsLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { BOTTOM_ITEMS, NAV_GROUPS, type NavItem } from "./nav-items";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function NavLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
        active
          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-sidebar-primary" : "text-sidebar-foreground/55")} aria-hidden />
      {item.label}
    </Link>
  );
}

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-sidebar">
      {/* Wordmark + collapse */}
      <div className="flex items-center justify-between px-4 pb-3 pt-4">
        <div className="flex items-center gap-2">
          <span className="h-5 w-5 rounded-[5px] bg-ht-green-accent" aria-hidden />
          <span className="text-[15px] font-semibold tracking-tight text-sidebar-foreground">Hightouch</span>
        </div>
        <ChevronsLeft className="h-4 w-4 text-sidebar-foreground/40" aria-hidden />
      </div>

      <WorkspaceSwitcher />

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-2" aria-label="Primary">
        {NAV_GROUPS.map((group, i) => (
          <div key={group.label ?? `g${i}`} className="space-y-0.5">
            {group.label && (
              <div className="px-2.5 pb-1 pt-1 text-[11px] font-medium uppercase tracking-wider text-sidebar-foreground/40">
                {group.label}
              </div>
            )}
            {group.items.map((item) => (
              <NavLink key={item.href} item={item} onNavigate={onNavigate} />
            ))}
          </div>
        ))}
      </nav>

      <div className="space-y-0.5 border-t border-sidebar-border p-3">
        {BOTTOM_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} onNavigate={onNavigate} />
        ))}
        <Link
          href="/how-it-works"
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        >
          <BookOpen className="h-4 w-4 text-sidebar-foreground/55" aria-hidden />
          Docs &amp; support
        </Link>
        <div className="mt-1 flex items-center gap-2.5 px-2.5 py-1.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ht-green-accent/20 text-[11px] font-semibold text-ht-green-accent">
            M
          </span>
          <span className="truncate text-[12px] text-sidebar-foreground/60">maria@fashionretailer.com</span>
        </div>
      </div>
    </div>
  );
}
