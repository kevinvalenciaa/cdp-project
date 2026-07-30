import { NewInvestigationClient } from "@/components/inbox/NewInvestigationClient";
import { getRequestContext } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function NewInvestigationPage() {
  await getRequestContext({ redirectToLogin: true });
  return <NewInvestigationClient />;
}
