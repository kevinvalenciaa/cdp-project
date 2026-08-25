import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle, type LucideIcon, Rocket, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusPill } from "@/components/common/StatusPill";
import { getRequestContext } from "@/server/auth";
import { getInvestigationRepository } from "@/server/investigations";
import { confidenceLabel, isSignificant, moneyCompact, pctFromPercent, pp, verdictMeta } from "@/lib/format";

function StatTile({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
}) {
  return (
    <div className="metric-card min-h-[116px]">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground/80">{label}</span>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ht-teal-tint">
          <Icon className="h-4 w-4 text-ht-teal" aria-hidden />
        </span>
      </div>
      <div className="mt-2 text-[28px] font-semibold tracking-[-0.03em] tabular-nums text-foreground">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

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
          <Link
            href="/opportunities"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-ht-xs transition-all hover:-translate-y-px hover:bg-ht-teal-hover"
          >
            Review opportunities <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        }
      />
      <div className="app-page">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Ready for review"
            value={String(ranked.length)}
            sub={ranked.length ? "proven with a holdout" : "run discovery to begin"}
            icon={Sparkles}
          />
          <StatTile
            label="Est. incremental revenue"
            value={`~${moneyCompact(totalImpact)}/mo`}
            sub="if all are launched"
            icon={TrendingUp}
          />
          {/* The Verifier's work, made countable. This is the differentiator on the first screen. */}
          <StatTile
            label="Rejected by the Verifier"
            value={String(rejected.length)}
            sub="no provable incremental lift"
            icon={ShieldCheck}
          />
          <StatTile
            label="Launched"
            value={String(activations.length)}
            sub={measured.length ? `${measured.length} measuring lift` : "none in flight"}
            icon={Rocket}
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          {/* Proven - what to act on */}
          <section className="surface-panel overflow-hidden xl:col-span-2">
            <div className="border-b border-border px-5 py-5 sm:px-6">
              <h2 className="text-lg font-semibold tracking-[-0.02em] text-foreground">Proven opportunities</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Ranked by reach × value × <em>incremental</em> uplift - not raw conversion.
              </p>
            </div>
            <ul className="divide-y divide-border px-2 py-2 sm:px-3">
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
          </section>

          {/* Ruled out - why to trust the list above */}
          <section className="surface-panel overflow-hidden">
            <div className="border-b border-border px-5 py-5">
              <h2 className="text-lg font-semibold tracking-[-0.02em] text-foreground">Ruled out overnight</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Candidates that convert well but could not be shown to <em>cause</em> the conversion.
              </p>
            </div>
            <ul className="divide-y divide-border px-2 py-2">
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
          </section>
        </div>

        {/* Closing the loop - what was launched and what it actually did */}
        {activations.length > 0 && (
          <section className="surface-panel overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-5 sm:px-6">
              <div>
                <h2 className="text-lg font-semibold tracking-[-0.02em] text-foreground">Launched &amp; measuring</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">Measured against a holdout after launch.</p>
              </div>
              <Link
                href="/launched"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                View all <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
            <ul className="divide-y divide-border px-2 py-2 sm:px-3">
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
          </section>
        )}
      </div>
    </>
  );
}
