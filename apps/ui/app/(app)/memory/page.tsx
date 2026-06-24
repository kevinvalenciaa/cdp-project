import { Brain } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";

export default function MemoryPage() {
  return (
    <>
      <PageHeader title="Memory" description="What the system has learned — verified insights that compound across runs." />
      <div className="p-5 lg:p-8">
        <EmptyState icon={Brain} title="Memory is empty" description="Verified outcomes from runs are recorded here so the next run starts smarter." />
      </div>
    </>
  );
}
