import { connectStats, connectWarehouse } from "../harness/mcp-client.js";
import { Memory } from "../memory/store.js";
import { DEAD_END_VERDICTS, toInsight } from "../memory/insights.js";
import {
  discoverCampaigns,
  seasonalityOpportunity,
  underservedOpportunity,
  verifyExperiment,
} from "../engine/engine.js";
import type { Opportunity } from "../engine/types.js";
import { CrashError, Journal } from "./journal.js";

export interface DurableRunResult {
  runId: string;
  resumedSteps: string[];
  executedThisRun: number;
  opportunities: Opportunity[];
  skippedFromMemory: { subject: string; claim: string }[];
  /** Stale dead-ends that were cheaply re-verified and re-confirmed this run. */
  revalidated: { subject: string; claim: string }[];
  insightsWritten: number;
  priorInsightCount: number;
}

/** Dead-end insights younger than this are trusted outright; older ones get re-verified. */
const FRESH_DAYS = 14;

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
  const revalidated: { subject: string; claim: string }[] = [];
  let insightsWritten = 0;
  let executedThisRun = 0;

  try {
    for (const cand of candidates) {
      const known = prior.find((p) => p.subject === cand.key && DEAD_END_VERDICTS.has(p.verdict));
      if (known) {
        const fresh = Date.now() - Date.parse(known.lastValidated ?? known.createdAt) < FRESH_DAYS * 86_400_000;
        if (fresh) {
          skippedFromMemory.push({ subject: cand.key, claim: known.claim });
          continue; // recently-confirmed dead-end - do not re-litigate
        }
        // Stale dead-end: cheap deterministic re-verification (SQL + stats, no LLM). If it
        // still holds, refresh last_validated and grow confidence a notch; if the verdict
        // CHANGED, fall through to the normal path so the new truth supersedes the old one.
        const recheck = await cand.make();
        if (DEAD_END_VERDICTS.has(recheck.verdict)) {
          await memory.revalidate(known.id, Math.min(0.95, known.confidence + 0.02));
          revalidated.push({ subject: cand.key, claim: known.claim });
          continue;
        }
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
            /* gate rejection or supersede race - ignore */
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
    revalidated,
    insightsWritten,
    priorInsightCount: prior.length,
  };
}
