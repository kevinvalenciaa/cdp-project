import Link from "next/link";
import { Activity, ArrowRight } from "lucide-react";
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
          <EmptyState
            icon={Activity}
            title="No activity yet"
            description="Every plan, query, rejection and confirmation the agents make shows up here as it happens."
            action={
              <Link
                href="/opportunities"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-ht-teal-hover"
              >
                Run a discovery <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            }
          />
        )}
      </div>
    </>
  );
}
