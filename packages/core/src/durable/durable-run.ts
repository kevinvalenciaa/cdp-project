import { connectStats, connectWarehouse } from "../harness/mcp-client.js";
import { Memory, type InsightRecord, type SubjectType } from "../memory/store.js";
import {
  discoverCampaigns,
  seasonalityOpportunity,
  underservedOpportunity,
  verifyExperiment,
} from "../engine/engine.js";
import type { Opportunity } from "../engine/types.js";
import { CrashError, Journal } from "./journal.js";

const DEAD_END_VERDICTS = new Set(["no_significant_lift", "explained_by_seasonality"]);

function subjectType(o: Opportunity): SubjectType {
  return o.type === "experiment" ? "campaign" : o.type === "seasonality" ? "initiative" : "audience";
}

function toInsight(o: Opportunity, runId: string): Omit<InsightRecord, "id" | "createdAt" | "validUntil"> {
  const claim = o.accepted
    ? `${o.title}: verified +${o.upliftPp?.toFixed(1)}pp incremental lift (p=${o.pValue?.toFixed(3)})`
    : o.verdict === "explained_by_seasonality"
      ? `${o.title}: seasonal pattern, not a real behavior change`
      : o.verdict === "needs_test"
        ? `${o.title}: untargeted high-value cohort; needs a designed holdout to prove lift`
        : `${o.title}: high raw conversion but NO incremental lift — not persuadable`;
  return {
    runId,
    subject: o.key,
    subjectType: subjectType(o),
    claim,
    verdict: o.verdict,
    evidence: JSON.stringify(o.evidence),
    confidence: o.accepted ? 0.9 : 0.8,
  };
}

export interface DurableRunResult {
  runId: string;
  resumedSteps: string[];
  executedThisRun: number;
  opportunities: Opportunity[];
  skippedFromMemory: { subject: string; claim: string }[];
  insightsWritten: number;
  priorInsightCount: number;
}

/**
 * Run the opportunity verification pipeline as durable, journaled steps, consulting and
 * updating compounding memory. Survives a crash (resume re-uses journaled steps) and skips
 * dead-ends already proven in memory (so run #2 doesn't re-litigate the killed trap).
 */
export async function durableRun(
  runId: string,
  opts: { crashAfter?: number; noMemory?: boolean } = {},
): Promise<DurableRunResult> {
  const journal = new Journal(runId);
  const resumedSteps = journal.completedSteps();
  const wh = await connectWarehouse();
  const stats = await connectStats();
  const memory = await Memory.open();
  const prior = opts.noMemory ? [] : await memory.getValid();

  const campaigns = await discoverCampaigns(wh);
  const candidates: { key: string; make: () => Promise<Opportunity> }[] = [
    ...campaigns.map((c) => ({ key: c.campaign_id, make: () => verifyExperiment(wh, stats, c) })),
    { key: "Q4_SURGE", make: () => seasonalityOpportunity(wh, stats) },
    { key: "UNDERSERVED_WORKWEAR", make: () => underservedOpportunity(wh) },
  ];

  const opportunities: Opportunity[] = [];
  const skippedFromMemory: { subject: string; claim: string }[] = [];
  let insightsWritten = 0;
  let executedThisRun = 0;

  try {
    for (const cand of candidates) {
      const known = prior.find((p) => p.subject === cand.key && DEAD_END_VERDICTS.has(p.verdict));
      if (known) {
        skippedFromMemory.push({ subject: cand.key, claim: known.claim });
        continue; // do not re-verify a dead-end already proven in memory
      }
      const { result, cached } = await journal.step(`verify:${cand.key}`, () => cand.make());
      const opp = result as Opportunity;
      opportunities.push(opp);
      if (!cached) {
        executedThisRun += 1;
        if (!opts.noMemory) {
          try {
            await memory.write(toInsight(opp, runId));
            insightsWritten += 1;
          } catch {
            /* gate rejection or supersede race — ignore */
          }
        }
        if (opts.crashAfter && executedThisRun >= opts.crashAfter) {
          throw new CrashError(`simulated crash after ${executedThisRun} executed steps`);
        }
      }
    }
  } finally {
    await wh.close();
    await stats.close();
    memory.close();
  }

  return {
    runId,
    resumedSteps,
    executedThisRun,
    opportunities,
    skippedFromMemory,
    insightsWritten,
    priorInsightCount: prior.length,
  };
}
