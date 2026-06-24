import { Inbox } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";

export default function OpportunitiesPage() {
  return (
    <>
      <PageHeader title="Opportunities" description="A ranked, self-refilling inbox of proven marketing opportunities." />
      <div className="p-5 lg:p-8">
        <EmptyState
          icon={Inbox}
          title="No discovery run yet"
          description="Pick a goal and run discovery — the agents will surface proven, holdout-tested opportunities here."
        />
      </div>
    </>
  );
}
