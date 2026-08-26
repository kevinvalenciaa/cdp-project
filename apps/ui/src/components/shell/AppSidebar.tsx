"use client";

import type { ComponentProps } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Plus } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { NavSearch } from "./NavSearch";
import { NavUser } from "./NavUser";
import { BOTTOM_ITEMS, NAV_GROUPS, type NavItem } from "./nav-items";

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/**
 * Nav row. The icon sits in its own span rather than as a direct child of the
 * button so it can carry the hover tilt independently of the button's own icon
 * rules, which is how the reference rail animates.
 */
function NavLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = isActive(pathname, item.href);
  const Icon = item.icon;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
        <Link href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined} className="group/link">
          <span
            className={cn(
              "inline-block transition-transform duration-300 ease-in-out group-hover/link:rotate-[20deg] [&>svg]:size-4 [&>svg]:shrink-0",
              active ? "[&>svg]:text-primary" : "[&>svg]:text-neutral-500",
            )}
          >
            <Icon aria-hidden />
          </span>
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function BrandRow() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <div className={cn("flex items-center pb-1 pt-3", collapsed ? "justify-center px-0" : "pl-2")}>
      {collapsed ? (
        <SidebarTrigger className="size-10 rounded-lg hover:bg-white/60" />
      ) : (
        <div className="flex w-full items-center">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <span className="size-7 shrink-0 rounded-[9px] bg-primary" aria-hidden />
            <span className="truncate text-[16px] font-semibold tracking-[-0.02em] text-foreground">Proofloop</span>
          </Link>
          <SidebarTrigger className="ml-auto rounded-lg hover:bg-white/60" />
        </div>
      )}
    </div>
  );
}

/** The primary CTA borrows the filled-gradient treatment from Button `special`. */
const CTA_CLASSES =
  "bg-[radial-gradient(228.59%_228.57%_at_50%_0%,_oklch(0.6544_0.0956_218.6)_0%,_oklch(0.4544_0.0956_218.6)_100%)] font-semibold text-primary-foreground shadow-[0px_0.75px_0px_0px_rgba(255,255,255,0.20)_inset,0px_1px_2px_0px_rgba(0,0,0,0.40),0px_0px_0px_1px_oklch(0.5044_0.0956_218.6)] transition-[filter] hover:brightness-110 hover:!bg-[radial-gradient(228.59%_228.57%_at_50%_0%,_oklch(0.6544_0.0956_218.6)_0%,_oklch(0.4544_0.0956_218.6)_100%)] [&>svg]:!text-primary-foreground";

export function AppSidebar({ onNavigate, ...props }: ComponentProps<typeof Sidebar> & { onNavigate?: () => void }) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <BrandRow />
      </SidebarHeader>

      <SidebarContent className="overflow-hidden">
        <NavSearch />

        <SidebarGroup className="py-0">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="New investigation" className={CTA_CLASSES}>
                <Link href="/investigations" onClick={onNavigate}>
                  <Plus aria-hidden />
                  <span>New investigation</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <nav
          aria-label="Primary"
          className="scrollbar-hide -mt-2 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto"
        >
          {NAV_GROUPS.map((group, index) => (
            <SidebarGroup key={group.label ?? `group-${index}`}>
              {group.label && (
                <SidebarGroupLabel className="text-sm font-normal text-neutral-600 group-data-[collapsible=icon]:hidden">
                  {group.label}
                </SidebarGroupLabel>
              )}
              <SidebarMenu>
                {group.items.map((item) => (
                  <NavLink key={item.href} item={item} onNavigate={onNavigate} />
                ))}
              </SidebarMenu>
            </SidebarGroup>
          ))}

          <SidebarSeparator />

          <SidebarGroup className="pb-6">
            <SidebarMenu>
              {BOTTOM_ITEMS.map((item) => (
                <NavLink key={item.href} item={item} onNavigate={onNavigate} />
              ))}
              <NavLink item={{ href: "/how-it-works", label: "Docs & support", icon: BookOpen }} onNavigate={onNavigate} />
            </SidebarMenu>
          </SidebarGroup>
        </nav>
      </SidebarContent>

      <SidebarFooter className="relative gap-2 p-0 pb-2 pt-0">
        {/* Fades the scrolling nav into the rail rather than cutting it off. */}
        <div className="pointer-events-none absolute inset-x-0 -top-16 h-16 bg-linear-to-b from-transparent to-sidebar" />
        <div className="px-2">
          <NavUser />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
