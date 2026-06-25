import Link from "next/link";
import { ArrowRight, type LucideIcon, Rocket, Sparkles, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { getProvider } from "@/server/data-provider";
import { moneyCompact, monthlyImpact, pp } from "@/lib/format";

function StatTile({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-ht-xs">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
      </div>
      <div className="mt-2 font-mono text-2xl font-semibold text-foreground">{value}</div>
    </div>
  );
}

export default async function HomePage() {
  const provider = await getProvider();
  const [run, activations] = await Promise.all([provider.getLatestRun(), provider.listActivations()]);
  const ranked = run?.opportunities.ranked ?? [];
  const totalImpact = ranked.reduce((s, o) => s + monthlyImpact(o), 0);

  return (
    <>
      <PageHeader title="Home" description="Your Agentic CDP at a glance — what the agents found while you were away." />
      <div className="space-y-6 p-5 lg:p-8">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile label="Opportunities ready for review" value={String(ranked.length)} icon={Sparkles} />
          <StatTile label="Est. incremental revenue" value={`${moneyCompact(totalImpact)}/mo`} icon={TrendingUp} />
          <StatTile label="Campaigns launched" value={String(activations.length)} icon={Rocket} />
        </div>

        <div className="rounded-lg border border-border bg-card shadow-ht-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Opportunities</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                The agents ranked {ranked.length} proven {ranked.length === 1 ? "opportunity" : "opportunities"} by estimated impact.
              </p>
            </div>
            <Link
              href="/opportunities"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-ht-teal-hover"
            >
              Review opportunities <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <ul className="divide-y divide-border">
            {ranked.slice(0, 3).map((o, i) => (
              <li key={o.key} className="flex items-center justify-between gap-3 px-5 py-3">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="font-mono text-sm text-muted-foreground">#{i + 1}</span>
                  <span className="truncate text-sm text-foreground">{o.title}</span>
                </span>
                <span className="shrink-0 font-mono text-sm text-ht-green">{moneyCompact(monthlyImpact(o))}/mo</span>
              </li>
            ))}
            {ranked.length === 0 && <li className="px-5 py-6 text-sm text-muted-foreground">No run yet — open Opportunities to run discovery.</li>}
          </ul>
        </div>
      </div>
    </>
  );
}
