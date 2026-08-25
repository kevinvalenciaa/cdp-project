import { notFound } from "next/navigation";
import { InvestigationClient } from "@/components/inbox/InvestigationClient";
import { getRequestContext } from "@/server/auth";
import { getInvestigationRepository } from "@/server/investigations";

export const dynamic = "force-dynamic";

export default async function InvestigationPage({
  params,
}: {
  params: Promise<{ investigationId: string }>;
}) {
  const { investigationId } = await params;
  const ctx = await getRequestContext({ redirectToLogin: true });
  const repository = await getInvestigationRepository();
  const investigation = await repository.getInvestigation(ctx, investigationId);
  if (!investigation) notFound();
  return <InvestigationClient initialInvestigation={investigation} />;
}
