import type { ReactNode } from "react";
import { OpportunitiesSidebar } from "@/components/inbox/OpportunitiesSidebar";
import { getRequestContext } from "@/server/auth";
import { getInvestigationRepository } from "@/server/investigations";

export const dynamic = "force-dynamic";

export default async function InvestigationsLayout({ children }: { children: ReactNode }) {
  const ctx = await getRequestContext({ redirectToLogin: true });
  const repository = await getInvestigationRepository();
  const investigations = await repository.listInvestigations(ctx, { status: "active", limit: 10 });

  return (
    <div className="flex min-h-full flex-col xl:h-full xl:flex-row">
      <OpportunitiesSidebar investigations={investigations} />
      <div className="min-w-0 flex-1 xl:min-h-0">{children}</div>
    </div>
  );
}
