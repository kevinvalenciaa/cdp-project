/**
 * Streaming wrapper around the opportunity engine. Reuses the exported per-candidate
 * verification functions and emits an event before/after each one, so a UI can show the
 * agents working in real time. No rewrite of runEngine — this re-composes its pieces.
 */
import { config } from "../shared/env.js";
import { CostLedger } from "../shared/cost.js";
import { connectStats, connectWarehouse } from "../harness/mcp-client.js";
import { newClient } from "../harness/loop.js";
import { runBandit, type BanditResult } from "../decisioning/bandit.js";
import {
  bareLlmJudge,
  discoverCampaigns,
  seasonalityOpportunity,
  underservedOpportunity,
  verifyExperiment,
} from "./engine.js";
import type { EngineResult, Opportunity } from "./types.js";

export type EngineStreamEvent =
  | { kind: "run_started"; goal: string; candidateCount: number }
  | { kind: "planning"; text: string }
  | { kind: "candidate_started"; key: string; title: string }
  | { kind: "candidate_verified"; opportunity: Opportunity }
  | { kind: "cost"; usd: number }
  | { kind: "run_finished"; result: EngineResult; bandit: BanditResult };

export async function runEngineStreaming(
  goal: string,
  onEvent: (e: EngineStreamEvent) => void,
  opts: { withBareLlmContrast?: boolean } = {},
): Promise<EngineResult> {
  const wh = await connectWarehouse();
  const stats = await connectStats();
  const client = newClient();
  const ledger = new CostLedger();
  try {
    const campaigns = await discoverCampaigns(wh);
    onEvent({ kind: "run_started", goal, candidateCount: campaigns.length + 2 });
    onEvent({ kind: "planning", text: "Planning the investigation — scanning campaigns, segments, and the order time-series." });

    const opps: Opportunity[] = [];
    const verifyAndEmit = async (key: string, title: string, make: () => Promise<Opportunity>) => {
      onEvent({ kind: "candidate_started", key, title });
      const o = await make();
      if (opts.withBareLlmContrast) o.bareLlm = await bareLlmJudge(client, ledger, o);
      opps.push(o);
      onEvent({ kind: "candidate_verified", opportunity: o });
      onEvent({ kind: "cost", usd: Number(ledger.totalUsd().toFixed(4)) });
    };

    for (const c of campaigns) await verifyAndEmit(c.campaign_id, c.name, () => verifyExperiment(wh, stats, c));
    await verifyAndEmit("Q4_SURGE", "Double down on the Q4 order surge", () => seasonalityOpportunity(wh, stats));
    await verifyAndEmit("UNDERSERVED_WORKWEAR", "Underserved: new workwear buyers", () => underservedOpportunity(wh));

    const ranked = opps.filter((o) => o.accepted).sort((a, b) => b.score - a.score);
    const rejected = opps.filter((o) => !o.accepted).sort((a, b) => b.reach * b.value - a.reach * a.value);
    const result: EngineResult = { goal, ranked, rejected, contrastUsd: ledger.totalUsd(), generatedFromSeed: config.seed };
    onEvent({ kind: "run_finished", result, bandit: runBandit(config.seed) });
    return result;
  } finally {
    await wh.close();
    await stats.close();
  }
}
