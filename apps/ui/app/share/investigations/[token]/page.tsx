import { createHash } from "node:crypto";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarClock, CheckCircle2, MessageSquareText, ShieldCheck, Sparkles } from "lucide-react";
import { moneyCompact, pp } from "@/lib/format";
import { getInvestigationRepository } from "@/server/investigations";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shared investigation - Proofloop",
  robots: { index: false, follow: false },
};

export default async function SharedInvestigationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const repository = await getInvestigationRepository();
  const share = await repository.getShareByHash(tokenHash);
  if (
    !share ||
    share.revokedAt ||
    (share.expiresAt != null && new Date(share.expiresAt).getTime() <= Date.now())
  ) {
    notFound();
  }
  const snapshot = share.snapshot;
  return (
    <main id="main" className="min-h-dvh bg-[#e9eef5] px-4 py-6 sm:px-6 lg:py-10">
      <div className="mx-auto max-w-5xl rounded-[26px] border border-white/80 bg-background p-4 shadow-ht-md sm:p-6 lg:p-8">
        <header className="rounded-[20px] border border-border bg-card p-6 shadow-ht-xs lg:p-8">
          <div className="flex items-center gap-2 text-sm font-medium text-ht-teal">
            <Sparkles className="h-4 w-4" aria-hidden /> Proofloop investigation
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-[-0.025em] text-foreground">{snapshot.title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{snapshot.objective}</p>
          <div className="mt-5 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden />
              Snapshot from {new Date(snapshot.asOf).toLocaleString()}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              Read-only · results do not update
            </span>
          </div>
        </header>

        <section className="mt-6" aria-labelledby="shared-results-heading">
          <h2 id="shared-results-heading" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Shared results
          </h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {snapshot.opportunities.map((opportunity) => (
              <article key={opportunity.occurrenceId} className="rounded-[18px] border border-border bg-card p-5 shadow-ht-xs">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-xs font-medium text-ht-green">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> {opportunity.verdict === "real_lift" ? "Proven" : opportunity.verdict}
                    </div>
                    <h3 className="mt-2 text-base font-semibold text-foreground">{opportunity.title}</h3>
                    <p className="mt-0.5 text-sm text-muted-foreground">{opportunity.segment}</p>
                  </div>
                  {opportunity.impactMonthly > 0 && (
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-ht-green">
                      ~{moneyCompact(opportunity.impactMonthly)}/mo
                    </span>
                  )}
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{opportunity.reason}</p>
                <div className="mt-3 flex gap-3 text-xs text-muted-foreground">
                  {opportunity.upliftPp != null && <span>{pp(opportunity.upliftPp)} lift</span>}
                  {opportunity.pValue != null && <span>p={opportunity.pValue.toFixed(3)}</span>}
                </div>
              </article>
            ))}
          </div>
          {snapshot.opportunities.length === 0 && (
            <div className="mt-3 rounded-[18px] border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
              No results were included in this snapshot.
            </div>
          )}
        </section>

        {snapshot.transcript && (
          <section className="mt-8" aria-labelledby="shared-transcript-heading">
            <h2 id="shared-transcript-heading" className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <MessageSquareText className="h-4 w-4" aria-hidden /> Transcript
            </h2>
            <div className="mt-3 space-y-3 rounded-[20px] border border-border bg-card p-5 shadow-ht-xs">
              {snapshot.transcript.map((message, index) => (
                <div key={`${message.createdAt}-${index}`} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm ${
                      message.role === "user"
                        ? "rounded-br-md bg-primary text-primary-foreground"
                        : "rounded-tl-md border border-border bg-background text-foreground"
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <p className="mt-8 text-center text-xs text-muted-foreground">
          This immutable snapshot may be revoked by its workspace owner.
        </p>
      </div>
    </main>
  );
}
