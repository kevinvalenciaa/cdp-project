"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, CalendarClock, MessageSquareText, Plus, Search, Sparkles, TrendingUp } from "lucide-react";
import type {
  InvestigationSummary,
  OpportunityOccurrence,
  WorkspaceOpportunity,
} from "@/lib/investigations";
import { confidenceLabel, moneyCompact, pp } from "@/lib/format";
import { OpportunityDetail } from "@/components/detail/OpportunityDetail";
import { StatusPill } from "@/components/common/StatusPill";

export function GlobalOpportunitiesClient({
  initialOpportunities,
  investigations,
}: {
  initialOpportunities: WorkspaceOpportunity[];
  investigations: InvestigationSummary[];
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"proven" | "superseded" | "stale" | "all">("proven");
  const [investigationId, setInvestigationId] = useState("all");
  const [segment, setSegment] = useState("all");
  const [verifiedWithinDays, setVerifiedWithinDays] = useState("all");
  const [selected, setSelected] = useState<WorkspaceOpportunity | null>(null);
  const [history, setHistory] = useState<OpportunityOccurrence[]>([]);
  const segments = useMemo(
    () => [...new Set(initialOpportunities.map((item) => item.current.opportunity.segment))].sort(),
    [initialOpportunities],
  );

  const opportunities = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return initialOpportunities.filter(
      (item) =>
        (status === "all" || item.status === status) &&
        (investigationId === "all" || item.current.investigationId === investigationId) &&
        (segment === "all" || item.current.opportunity.segment === segment) &&
        (verifiedWithinDays === "all" ||
          new Date(item.current.verifiedAt).getTime() >=
            Date.now() - Number(verifiedWithinDays) * 86_400_000) &&
        (!normalized ||
          item.current.opportunity.title.toLowerCase().includes(normalized) ||
          item.current.opportunity.segment.toLowerCase().includes(normalized)),
    );
  }, [initialOpportunities, investigationId, query, segment, status, verifiedWithinDays]);

  const proven = initialOpportunities.filter((item) => item.status === "proven");
  const totalImpact = proven.reduce((sum, item) => sum + item.current.impactMonthly, 0);
  const stale = initialOpportunities.filter((item) => item.status === "stale").length;

  async function selectOpportunity(item: WorkspaceOpportunity) {
    setSelected(item);
    setHistory([]);
    const response = await fetch(`/api/opportunities/${encodeURIComponent(item.key)}`, {
      cache: "no-store",
    });
    if (!response.ok) return;
    const payload = (await response.json()) as { history?: OpportunityOccurrence[] };
    setHistory(payload.history ?? []);
  }

  return (
    <>
      <div className="min-h-full bg-background">
        <header className="border-b border-border px-5 py-5 lg:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-ht-teal" aria-hidden />
                <h1 className="text-xl font-semibold tracking-tight text-foreground">Opportunities</h1>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                The latest proven results across every workspace investigation.
              </p>
            </div>
            <Link
              href="/opportunities/new"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-foreground px-4 text-sm font-medium text-background shadow-ht-xs transition-opacity hover:opacity-85"
            >
              <Plus className="h-4 w-4" aria-hidden /> New investigation
            </Link>
          </div>
        </header>

        <div className="space-y-6 p-5 lg:p-8">
          <section className="grid gap-3 sm:grid-cols-3" aria-label="Opportunity summary">
            <SummaryCard icon={Sparkles} label="Currently proven" value={String(proven.length)} />
            <SummaryCard icon={TrendingUp} label="Est. monthly impact" value={`~${moneyCompact(totalImpact)}`} />
            <SummaryCard icon={CalendarClock} label="Needs re-verification" value={String(stale)} />
          </section>

          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-ht-xs md:flex-row">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3">
              <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
              <span className="sr-only">Search opportunities</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search opportunities or segments…"
                className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </label>
            <select
              aria-label="Filter by status"
              value={status}
              onChange={(event) => setStatus(event.target.value as typeof status)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none"
            >
              <option value="proven">Proven</option>
              <option value="stale">Stale</option>
              <option value="superseded">Superseded</option>
              <option value="all">All results</option>
            </select>
            <select
              aria-label="Filter by segment"
              value={segment}
              onChange={(event) => setSegment(event.target.value)}
              className="h-10 min-w-40 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none"
            >
              <option value="all">Every segment</option>
              {segments.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by verification date"
              value={verifiedWithinDays}
              onChange={(event) => setVerifiedWithinDays(event.target.value)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none"
            >
              <option value="all">Any verification date</option>
              <option value="7">Verified in 7 days</option>
              <option value="30">Verified in 30 days</option>
              <option value="90">Verified in 90 days</option>
            </select>
            <select
              aria-label="Filter by investigation"
              value={investigationId}
              onChange={(event) => setInvestigationId(event.target.value)}
              className="h-10 min-w-48 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none"
            >
              <option value="all">Every investigation</option>
              {investigations.map((investigation) => (
                <option key={investigation.id} value={investigation.id}>
                  {investigation.title}
                </option>
              ))}
            </select>
          </div>

          <section aria-label="Workspace opportunities">
            {opportunities.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center">
                <Sparkles className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden />
                <h2 className="mt-3 text-sm font-medium text-foreground">No matching opportunities</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Adjust the filters or start a new investigation to discover verified lift.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 xl:grid-cols-2">
                {opportunities.map((item) => {
                  const opportunity = item.current.opportunity;
                  return (
                    <article
                      key={item.key}
                      className="group rounded-xl border border-border bg-card p-4 shadow-ht-xs transition-colors hover:border-ht-400"
                    >
                      <button onClick={() => void selectOpportunity(item)} className="w-full text-left">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <StatusPill
                                tone={item.status === "proven" ? "emerald" : item.status === "stale" ? "amber" : "rose"}
                              >
                                {item.status}
                              </StatusPill>
                              <span className="text-xs text-muted-foreground">
                                {item.occurrenceCount} {item.occurrenceCount === 1 ? "occurrence" : "occurrences"}
                              </span>
                              {item.activationStatus && <StatusPill tone="blue">activation {item.activationStatus}</StatusPill>}
                            </div>
                            <h2 className="mt-2 truncate text-base font-semibold text-foreground">{opportunity.title}</h2>
                            <p className="mt-0.5 truncate text-sm text-muted-foreground">{opportunity.segment}</p>
                          </div>
                          <span className="shrink-0 font-mono text-base font-semibold tabular-nums text-ht-green">
                            ~{moneyCompact(item.current.impactMonthly)}/mo
                          </span>
                        </div>
                        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{opportunity.reason}</p>
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {opportunity.upliftPp != null && <span>{pp(opportunity.upliftPp)} lift</span>}
                          {confidenceLabel(opportunity) && <span>{confidenceLabel(opportunity)}</span>}
                          <span>reach {opportunity.reach.toLocaleString()}</span>
                        </div>
                      </button>
                      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs">
                        <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                          <MessageSquareText className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          <span className="truncate">{item.current.sourceInvestigationTitle}</span>
                        </span>
                        <Link
                          href={`/opportunities/${item.current.investigationId}`}
                          className="ml-3 inline-flex shrink-0 items-center gap-1 font-medium text-foreground hover:underline"
                        >
                          Open chat <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      <OpportunityDetail
        opportunity={selected?.current.opportunity ?? null}
        activation={null}
        occurrenceId={selected?.current.id}
        canActivate={selected?.status === "proven"}
        activationStatus={selected?.activationStatus ?? null}
        history={history}
        open={selected != null}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
            setHistory([]);
          }
        }}
      />
    </>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Sparkles;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-ht-xs">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <Icon className="h-4 w-4" aria-hidden />
        {label}
      </div>
      <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}
