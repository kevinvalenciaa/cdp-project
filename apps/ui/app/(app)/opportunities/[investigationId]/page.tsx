import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LegacyInvestigationPage({
  params,
}: {
  params: Promise<{ investigationId: string }>;
}) {
  const { investigationId } = await params;
  redirect(`/investigations/${investigationId}`);
}
