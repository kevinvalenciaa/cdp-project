import { PageHeader } from "@/components/common/PageHeader";
import { InboxClient } from "@/components/inbox/InboxClient";
import { getProvider } from "@/server/data-provider";

export default async function OpportunitiesPage() {
  const provider = await getProvider();
  const [run, goals] = await Promise.all([provider.getLatestRun(), provider.listGoals()]);
  return (
    <>
      <PageHeader title="Opportunities" description="A ranked, self-refilling inbox of proven marketing opportunities." />
      <InboxClient initialRun={run} goals={goals} />
    </>
  );
}
