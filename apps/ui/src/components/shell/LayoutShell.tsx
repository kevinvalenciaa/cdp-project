"use client";

import type { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";
import { usePersistedToggle } from "@/lib/use-persisted-toggle";

/**
 * Client shell around the app chrome so the desktop sidebar can collapse at
 * will. Its compact state remains an icon rail, and the preference persists
 * across reloads.
 * Mobile navigation keeps its existing sheet — this only governs lg+.
 */
export function LayoutShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, toggleSidebar] = usePersistedToggle("ui.sidebar-open", true);

  return (
    <div className="flex min-h-screen">
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 overflow-hidden border-r border-sidebar-border transition-[width] duration-200 ease-out lg:block ${
          sidebarOpen ? "w-60" : "w-16"
        }`}
      >
        <div className="h-full w-full">
          <AppSidebar collapsed={!sidebarOpen} onToggleSidebar={toggleSidebar} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main id="main" className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
