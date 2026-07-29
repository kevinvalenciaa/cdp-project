import { InboxClient } from "@/components/inbox/InboxClient";
import { getProvider } from "@/server/data-provider";

export default async function OpportunitiesPage() {
  const provider = await getProvider();
  const [run, goals] = await Promise.all([provider.getLatestRun(), provider.listGoals()]);
  return <InboxClient initialRun={run} goals={goals} />;
}
