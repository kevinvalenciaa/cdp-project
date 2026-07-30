import { GlobalOpportunitiesClient } from "@/components/inbox/GlobalOpportunitiesClient";
import { getRequestContext } from "@/server/auth";
import { getInvestigationRepository } from "@/server/investigations";

export const dynamic = "force-dynamic";

export default async function OpportunitiesPage() {
  const ctx = await getRequestContext({ redirectToLogin: true });
  const repository = await getInvestigationRepository();
  const opportunities = await repository.listOpportunities(ctx, { status: "all" });
  const investigations = await repository.listInvestigations(ctx, { status: "active", limit: 100 });
  return <GlobalOpportunitiesClient initialOpportunities={opportunities} investigations={investigations} />;
}
