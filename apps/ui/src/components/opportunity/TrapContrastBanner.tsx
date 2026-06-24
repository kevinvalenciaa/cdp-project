import { ShieldAlert, ThumbsUp, XCircle } from "lucide-react";
import type { Opportunity } from "@/lib/types";
import { pct } from "@/lib/format";
import { StatusPill } from "@/components/common/StatusPill";

/** The headline: a high-conversion campaign a normal AI accepts but the Verifier rejects. */
export function TrapContrastBanner({ trap }: { trap: Opportunity }) {
  if (!trap.bareLlm) return null;
  return (
    <section className="rounded-xl border border-rose-500/20 bg-rose-500/[0.06] p-5">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-rose-300">
        <ShieldAlert className="h-4 w-4" aria-hidden />
        The trap a normal AI falls for
      </div>
      <div className="mt-2 text-lg font-medium text-foreground">
        {trap.title}
        {trap.rawConversion != null && <span className="text-muted-foreground"> — {pct(trap.rawConversion)} conversion</span>}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border/60 bg-background/40 p-3.5">
          <StatusPill tone="rose">
            <ThumbsUp className="h-3 w-3" aria-hidden /> Bare LLM: accept
          </StatusPill>
          <p className="mt-2 text-sm text-slate-300">“{trap.bareLlm.reason}”</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-background/40 p-3.5">
          <StatusPill tone="emerald">
            <XCircle className="h-3 w-3" aria-hidden /> Verifier: reject
          </StatusPill>
          <p className="mt-2 text-sm text-slate-300">{trap.reason}</p>
        </div>
      </div>
    </section>
  );
}
