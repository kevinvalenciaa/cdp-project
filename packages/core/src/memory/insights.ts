import type { Opportunity } from "../engine/types.js";
import type { InsightRecord, SubjectType } from "./store.js";

/** Verdicts that are settled dead ends - memory can safely skip re-litigating them. */
export const DEAD_END_VERDICTS = new Set(["no_significant_lift", "explained_by_seasonality"]);

export function subjectType(o: Opportunity): SubjectType {
  return o.type === "experiment" ? "campaign" : o.type === "seasonality" ? "initiative" : "audience";
}

/**
 * Map a verified Opportunity to a memory insight. Shared by the durable pipeline, the
 * streaming engine, and activation - one claim vocabulary everywhere. Evidence carries the
 * run id + the query fingerprints from provenance so every remembered claim stays traceable
 * to the exact (query, result) pairs that produced it.
 */
export function toInsight(o: Opportunity, runId: string): Omit<InsightRecord, "id" | "createdAt" | "validUntil" | "lastValidated"> {
  const claim = o.accepted
    ? `${o.title}: verified +${o.upliftPp?.toFixed(1)}pp incremental lift (p=${o.pValue?.toFixed(3)})`
    : o.verdict === "explained_by_seasonality"
      ? `${o.title}: seasonal pattern, not a real behavior change`
      : o.verdict === "needs_test"
        ? `${o.title}: untargeted high-value cohort; needs a designed holdout to prove lift`
        : `${o.title}: high raw conversion but NO incremental lift - not persuadable`;
  return {
    runId,
    subject: o.key,
    subjectType: subjectType(o),
    claim,
    verdict: o.verdict,
    evidence: JSON.stringify({
      ...o.evidence,
      runIds: [runId],
      fingerprints: o.provenance?.queries.map((q) => q.fingerprint) ?? [],
    }),
    confidence: o.accepted ? 0.9 : 0.8,
  };
}
