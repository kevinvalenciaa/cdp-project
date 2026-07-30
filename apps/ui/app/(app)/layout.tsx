import type { ReactNode } from "react";
import { LayoutShell } from "@/components/shell/LayoutShell";
import { getRequestContext } from "@/server/auth";

// Always render fresh (live data updates per request; harmless for demo).
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  await getRequestContext({ redirectToLogin: true });
  return <LayoutShell>{children}</LayoutShell>;
}
