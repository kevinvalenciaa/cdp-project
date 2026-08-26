import type { ReactNode } from "react";
import { OpportunitiesSidebar } from "@/components/inbox/OpportunitiesSidebar";
import { getRequestContext } from "@/server/auth";
import { getInvestigationRepository } from "@/server/investigations";

export const dynamic = "force-dynamic";

export default async function InvestigationsLayout({ children }: { children: ReactNode }) {
  const ctx = await getRequestContext({ redirectToLogin: true });
  const repository = await getInvestigationRepository();
  // Fetch one past the cap so the rail can tell whether an "All investigations"
  // link is warranted, rather than guessing.
  const RAIL_LIMIT = 10;
  const recent = await repository.listInvestigations(ctx, { status: "active", limit: RAIL_LIMIT + 1 });
  const investigations = recent.slice(0, RAIL_LIMIT);

  return (
    <div className="flex min-h-full flex-col xl:h-full xl:flex-row">
      <OpportunitiesSidebar investigations={investigations} hasMore={recent.length > RAIL_LIMIT} />
      <div className="min-w-0 flex-1 xl:min-h-0">{children}</div>
    </div>
  );
}
