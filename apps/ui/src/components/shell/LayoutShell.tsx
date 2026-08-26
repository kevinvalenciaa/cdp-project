"use client";

import type { CSSProperties, ReactNode } from "react";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";

/**
 * App chrome: a tinted page surface carrying the nav rail, with the routed
 * content floating above it as an inset card. Below md the rail collapses into
 * a Sheet, which the Sidebar primitive renders for us - so there is no separate
 * mobile header component any more.
 *
 * `defaultOpen` is resolved on the server from the sidebar_state cookie so the
 * first paint already has the right rail width, with no expand-then-collapse
 * flash on reload.
 */
export function LayoutShell({ children, defaultOpen = true }: { children: ReactNode; defaultOpen?: boolean }) {
  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      {/* id="main" is the target of the skip link in app/layout.tsx. */}
      <SidebarInset id="main">{children}</SidebarInset>
    </SidebarProvider>
  );
}
