import Link from "next/link";
import { Activity, ArrowRight } from "lucide-react";
import type { EngineEvent } from "@/lib/types";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ActivityFeed } from "@/components/activity/ActivityFeed";
import { getRequestContext } from "@/server/auth";
import { getInvestigationRepository } from "@/server/investigations";

export default async function ActivityPage() {
  const ctx = await getRequestContext({ redirectToLogin: true });
  const repository = await getInvestigationRepository();
  const envelopes = await repository.listWorkspaceEvents(ctx, 300);
  const events = envelopes
    .map((envelope) => envelope.event)
    .filter((event): event is EngineEvent => isEngineEvent(event))
    .reverse();
  return (
    <>
      <PageHeader title="Activity" description="Workspace-wide agent work across every investigation." />
      <div className="p-5 lg:p-8">
        {events.length > 0 ? (
          <div className="rounded-xl border border-border bg-card p-5 shadow-ht-xs">
            <div className="mb-3 text-sm font-medium text-foreground">Recent investigation activity</div>
            <ActivityFeed events={events} />
          </div>
        ) : (
          <EmptyState
            icon={Activity}
            title="No activity yet"
            description="Every plan, query, rejection and confirmation the agents make shows up here."
            action={
              <Link
                href="/opportunities/new"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
              >
                Run an investigation <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            }
          />
        )}
      </div>
    </>
  );
}

function isEngineEvent(event: { kind: string }): event is EngineEvent {
  return (
    event.kind === "run_started" ||
    event.kind === "explorer_started" ||
    event.kind === "hypothesis_proposed" ||
    event.kind === "planning" ||
    event.kind === "memory_hit" ||
    event.kind === "candidate_started" ||
    event.kind === "candidate_verified" ||
    event.kind === "prioritizing" ||
    event.kind === "cost" ||
    event.kind === "run_finished" ||
    event.kind === "error"
  );
}
