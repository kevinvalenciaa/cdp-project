import { Rocket } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";

export default function LaunchedPage() {
  return (
    <>
      <PageHeader title="Launched & Measuring" description="Approved campaigns, their measured incremental lift, and per-segment optimization." />
      <div className="p-5 lg:p-8">
        <EmptyState icon={Rocket} title="Nothing launched yet" description="Approve an opportunity to launch it and measure its lift against a holdout." />
      </div>
    </>
  );
}
