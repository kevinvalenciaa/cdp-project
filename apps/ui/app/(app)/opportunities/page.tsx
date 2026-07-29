import { InboxClient } from "@/components/inbox/InboxClient";
import { getProvider } from "@/server/data-provider";

export default async function OpportunitiesPage() {
  const provider = await getProvider();
  const run = await provider.getLatestRun();
  return <InboxClient initialRun={run} />;
}
