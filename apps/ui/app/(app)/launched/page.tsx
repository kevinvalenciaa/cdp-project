import Link from "next/link";
import { ArrowRight, Rocket } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { LaunchedView } from "@/components/launched/LaunchedView";
import { Button } from "@/components/ui/button";
import { getProvider } from "@/server/data-provider";
import { getRequestContext } from "@/server/auth";
import { getInvestigationRepository } from "@/server/investigations";

export default async function LaunchedPage() {
  const ctx = await getRequestContext({ redirectToLogin: true });
  const repository = await getInvestigationRepository();
  const provider = await getProvider();
  const [activations, bandit, latestActivation] = await Promise.all([
    repository.listActivations(ctx),
    provider.getBandit(),
    repository.getLatestActivation(ctx),
  ]);
  const measurement = latestActivation?.measurement ?? null;

  return (
    <>
      <PageHeader title="Launched & Measuring" description="Approved campaigns, their measured incremental lift, and per-segment optimization." />
      {activations.length > 0 ? (
        <LaunchedView activations={activations} measurement={measurement} bandit={bandit} />
      ) : (
        <div className="app-page">
          <EmptyState
            icon={Rocket}
            title="Nothing launched yet"
            description="Approve an opportunity and it launches against a holdout, so its incremental lift is measured from day one."
            action={
              <Button asChild>
                <Link href="/opportunities">
                  Review opportunities <ArrowRight aria-hidden />
                </Link>
              </Button>
            }
          />
        </div>
      )}
    </>
  );
}
