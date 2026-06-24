import { Rocket } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { LaunchedView } from "@/components/launched/LaunchedView";
import { getProvider } from "@/server/data-provider";

export default async function LaunchedPage() {
  const provider = await getProvider();
  const [activations, bandit, run] = await Promise.all([
    provider.listActivations(),
    provider.getBandit(),
    provider.getLatestRun(),
  ]);
  const measurement = run?.activation?.measurement ?? null;

  return (
    <>
      <PageHeader title="Launched & Measuring" description="Approved campaigns, their measured incremental lift, and per-segment optimization." />
      {activations.length > 0 ? (
        <LaunchedView activations={activations} measurement={measurement} bandit={bandit} />
      ) : (
        <div className="p-5 lg:p-8">
          <EmptyState icon={Rocket} title="Nothing launched yet" description="Approve an opportunity to launch it and measure its lift." />
        </div>
      )}
    </>
  );
}
