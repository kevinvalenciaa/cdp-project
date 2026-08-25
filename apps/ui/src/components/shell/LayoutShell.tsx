"use client";

import type { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";
import { usePersistedToggle } from "@/lib/use-persisted-toggle";

/**
 * Client shell around the app chrome so the desktop sidebar can collapse at
 * will. Its compact state remains an icon rail, and the preference persists
 * across reloads.
 * Mobile navigation keeps its existing sheet - this only governs lg+.
 */
export function LayoutShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, toggleSidebar] = usePersistedToggle("ui.sidebar-open", true);

  return (
    <div className="min-h-dvh bg-[#e9eef5] lg:p-2">
      <div className="flex min-h-dvh overflow-hidden bg-background lg:h-[calc(100dvh-1rem)] lg:min-h-0 lg:rounded-[26px] lg:border lg:border-white/80 lg:shadow-ht-md">
        <aside
          className={`hidden h-full shrink-0 overflow-hidden border-r border-sidebar-border transition-[width] duration-200 ease-out lg:block ${
            sidebarOpen ? "w-[272px]" : "w-[72px]"
          }`}
        >
          <div className="h-full w-full">
            <AppSidebar collapsed={!sidebarOpen} onToggleSidebar={toggleSidebar} />
          </div>
        </aside>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <TopBar />
          <main id="main" className="min-h-0 flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
