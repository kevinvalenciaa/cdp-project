import { ShieldAlert, ThumbsUp, XCircle } from "lucide-react";
import type { Opportunity } from "@/lib/types";
import { pctFromPercent } from "@/lib/format";
import { StatusPill } from "@/components/common/StatusPill";

/** Our differentiator, in Hightouch's idiom: a high-conversion campaign a generic AI
 *  would approve but the Verifier rejects for having no incremental lift. */
export function TrapContrastBanner({ trap }: { trap: Opportunity }) {
  if (!trap.bareLlm) return null;
  return (
    <section className="rounded-xl border border-ht-danger/20 bg-ht-danger-bg/50 p-5">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ht-danger-text">
        <ShieldAlert className="h-4 w-4" aria-hidden />
        Caught before it cost you
      </div>
      <div className="mt-2 text-base font-medium text-foreground">
        {trap.title}
        {trap.rawConversion != null && (
          <span className="text-muted-foreground"> — {pctFromPercent(trap.rawConversion)} raw conversion, but no incremental lift</span>
        )}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-3.5 shadow-ht-xs">
          <StatusPill tone="rose">
            <ThumbsUp className="h-3 w-3" aria-hidden /> A generic AI approves
          </StatusPill>
          <p className="mt-2 text-sm text-muted-foreground">“{trap.bareLlm.reason}”</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3.5 shadow-ht-xs">
          <StatusPill tone="emerald">
            <XCircle className="h-3 w-3" aria-hidden /> The verifier rejects it
          </StatusPill>
          <p className="mt-2 text-sm text-muted-foreground">{trap.reason}</p>
        </div>
      </div>
    </section>
  );
}
