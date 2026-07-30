import type { ReactNode } from "react";
import { LayoutShell } from "@/components/shell/LayoutShell";

// Always render fresh (live data updates per request; harmless for demo).
export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: ReactNode }) {
  return <LayoutShell>{children}</LayoutShell>;
}
