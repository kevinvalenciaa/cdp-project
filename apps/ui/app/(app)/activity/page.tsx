import { Activity } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ActivityFeed } from "@/components/activity/ActivityFeed";
import { getProvider } from "@/server/data-provider";

export default async function ActivityPage() {
  const provider = await getProvider();
  const events = await provider.getActivity();
  return (
    <>
      <PageHeader title="Activity" description="Watch the agents work — planning, investigating, rejecting, and confirming." />
      <div className="p-5 lg:p-8">
        {events.length > 0 ? (
          <div className="rounded-xl border border-border bg-card p-5 shadow-ht-xs">
            <div className="mb-3 text-sm font-medium text-foreground">Latest discovery run</div>
            <ActivityFeed events={events} />
          </div>
        ) : (
          <EmptyState icon={Activity} title="No activity yet" description="Run a discovery to see the agents work." />
        )}
      </div>
    </>
  );
}
