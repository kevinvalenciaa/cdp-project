import type { ReactNode } from "react";
import { AppSidebar } from "@/components/shell/AppSidebar";
import { TopBar } from "@/components/shell/TopBar";
import { MODE } from "@/lib/mode";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-sidebar-border lg:block">
        <AppSidebar />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar mode={MODE} />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
