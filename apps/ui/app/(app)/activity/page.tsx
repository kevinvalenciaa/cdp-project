import { Activity } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";

export default function ActivityPage() {
  return (
    <>
      <PageHeader title="Activity" description="Watch the agents work — planning, investigating, rejecting, and confirming." />
      <div className="p-5 lg:p-8">
        <EmptyState icon={Activity} title="No activity yet" description="Run a discovery to see the agents work in real time." />
      </div>
    </>
  );
}
