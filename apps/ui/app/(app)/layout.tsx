import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { LayoutShell } from "@/components/shell/LayoutShell";
import { SIDEBAR_COOKIE_NAME } from "@/lib/sidebar-cookie";
import { getRequestContext } from "@/server/auth";

// Always render fresh (live data updates per request; harmless for demo).
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  await getRequestContext({ redirectToLogin: true });
  // Read the rail's persisted state here so the server emits the correct width
  // on first paint instead of flashing open then collapsing.
  const store = await cookies();
  const sidebarOpen = store.get(SIDEBAR_COOKIE_NAME)?.value !== "false";
  return <LayoutShell defaultOpen={sidebarOpen}>{children}</LayoutShell>;
}
