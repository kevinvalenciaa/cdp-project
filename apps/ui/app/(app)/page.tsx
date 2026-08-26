import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle, Rocket, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusPill } from "@/components/common/StatusPill";
import { StatCard, StatCardGrid } from "@/components/dashboard/StatCard";
import { Button } from "@/components/ui/button";
import {
  ChartCard,
  ChartCardActions,
  ChartCardDescription,
  ChartCardHeader,
  ChartCardHeading,
  ChartCardTitle,
} from "@/components/ui/chart-card";
import { getRequestContext } from "@/server/auth";
import { getInvestigationRepository } from "@/server/investigations";
import { confidenceLabel, isSignificant, moneyCompact, pctFromPercent, pp, verdictMeta } from "@/lib/format";

export default async function HomePage() {
  const ctx = await getRequestContext({ redirectToLogin: true });
  const repository = await getInvestigationRepository();
  const [ranked, rejected, activations] = await Promise.all([
    repository.listOpportunities(ctx, { status: "proven" }),
    repository.listOpportunities(ctx, { status: "superseded" }),
    repository.listActivations(ctx),
  ]);
  const totalImpact = ranked.reduce((sum, item) => sum + item.current.impactMonthly, 0);
  const measured = activations.filter((a) => a.upliftPp != null);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Your Agentic CDP at a glance - what the agents found while you were away."
        actions={
          <Button asChild>
            <Link href="/opportunities">
              Review opportunities <ArrowRight aria-hidden />
            </Link>
          </Button>
        }
      />
      <div className="app-page">
        <StatCardGrid>
          <StatCard
            label="Ready for review"
            value={String(ranked.length)}
            sub={ranked.length ? "proven with a holdout" : "run discovery to begin"}
            icon={Sparkles}
          />
          <StatCard
            label="Est. incremental revenue"
            value={`~${moneyCompact(totalImpact)}/mo`}
            sub="if all are launched"
            icon={TrendingUp}
          />
          {/* The Verifier's work, made countable. This is the differentiator on the first screen. */}
          <StatCard
            label="Rejected by the Verifier"
            value={String(rejected.length)}
            sub="no provable incremental lift"
            icon={ShieldCheck}
          />
          <StatCard
            label="Launched"
            value={String(activations.length)}
            sub={measured.length ? `${measured.length} measuring lift` : "none in flight"}
            icon={Rocket}
          />
        </StatCardGrid>

        <div className="grid gap-4 xl:grid-cols-3">
          {/* Proven - what to act on */}
          <ChartCard className="overflow-hidden xl:col-span-2">
            <ChartCardHeader>
              <ChartCardTitle>
                <ChartCardHeading>Proven opportunities</ChartCardHeading>
                <ChartCardDescription>
                  Ranked by reach × value × <em>incremental</em> uplift - not raw conversion.
                </ChartCardDescription>
              </ChartCardTitle>
            </ChartCardHeader>
            <ul className="-mt-2 divide-y divide-border px-3">
              {ranked.slice(0, 4).map((item, i) => {
                const o = item.current.opportunity;
                return (
                <li key={item.key} className="rounded-xl px-3 py-3.5 transition-colors hover:bg-muted/45">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-xs font-semibold tabular-nums text-muted-foreground">#{i + 1}</span>
                      <span className="truncate text-sm text-foreground">{o.title}</span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-ht-green">
                      ~{moneyCompact(item.current.impactMonthly)}/mo
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 pl-10 text-xs text-muted-foreground">
                    {o.upliftPp != null && <span className="tabular-nums text-foreground">{pp(o.upliftPp)} lift</span>}
                    {confidenceLabel(o) && (
                      <span className={`inline-flex items-center gap-1 ${isSignificant(o) ? "text-ht-green" : ""}`}>
                        {isSignificant(o) ? (
                          <CheckCircle2 className="h-3 w-3" aria-hidden />
                        ) : (
                          <Circle className="h-3 w-3" aria-hidden />
                        )}
                        {confidenceLabel(o)}
                      </span>
                    )}
                  </div>
                </li>
                );
              })}
              {ranked.length === 0 && (
                <li className="px-4 py-8 text-sm text-muted-foreground">No run yet - open Opportunities to run discovery.</li>
              )}
            </ul>
          </ChartCard>

          {/* Ruled out - why to trust the list above */}
          <ChartCard className="overflow-hidden">
            <ChartCardHeader>
              <ChartCardTitle>
                <ChartCardHeading>Ruled out overnight</ChartCardHeading>
                <ChartCardDescription>
                  Candidates that convert well but could not be shown to <em>cause</em> the conversion.
                </ChartCardDescription>
              </ChartCardTitle>
            </ChartCardHeader>
            <ul className="-mt-2 divide-y divide-border px-3">
              {rejected.slice(0, 4).map((item) => {
                const o = item.current.opportunity;
                const m = verdictMeta(o.verdict);
                return (
                  <li key={item.key} className="flex items-center justify-between gap-3 rounded-xl px-3 py-3.5 transition-colors hover:bg-muted/45">
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-foreground">{o.title}</span>
                      {o.rawConversion != null && (
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {pctFromPercent(o.rawConversion)} raw conversion
                        </span>
                      )}
                    </span>
                    <StatusPill tone={m.tone}>{m.label}</StatusPill>
                  </li>
                );
              })}
              {rejected.length === 0 && (
                <li className="px-4 py-8 text-sm text-muted-foreground">Nothing ruled out yet.</li>
              )}
            </ul>
          </ChartCard>
        </div>

        {/* Closing the loop - what was launched and what it actually did */}
        {activations.length > 0 && (
          <ChartCard className="overflow-hidden">
            <ChartCardHeader>
              <ChartCardTitle>
                <ChartCardHeading>Launched &amp; measuring</ChartCardHeading>
                <ChartCardDescription>Measured against a holdout after launch.</ChartCardDescription>
              </ChartCardTitle>
              <ChartCardActions>
                <Link
                  href="/launched"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  View all <ArrowRight className="size-4" aria-hidden />
                </Link>
              </ChartCardActions>
            </ChartCardHeader>
            <ul className="-mt-2 divide-y divide-border px-3">
              {activations.slice(0, 3).map((a) => (
                <li key={a.opportunityKey} className="flex items-center justify-between gap-3 rounded-xl px-3 py-3.5 transition-colors hover:bg-muted/45">
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-foreground">{a.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {a.destination} · {a.audienceSize.toLocaleString()} customers
                    </span>
                  </span>
                  {a.upliftPp != null && (
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-ht-green">{pp(a.upliftPp)} lift</span>
                  )}
                </li>
              ))}
            </ul>
          </ChartCard>
        )}
      </div>
    </>
  );
}
