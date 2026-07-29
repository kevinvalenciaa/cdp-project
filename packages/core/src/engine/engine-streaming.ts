/**
 * Streaming wrapper around the opportunity engine. Reuses the exported per-candidate
 * verification functions and emits an event before/after each one, so a UI can show the
 * agents working in real time. No rewrite of runEngine — this re-composes its pieces.
 *
 * Deliberately SEQUENTIAL where runEngine parallelizes: the stream exists for narrative
 * legibility — interleaved candidate_started/candidate_verified pairs would force per-key
 * correlation onto every consumer for zero user-visible win in a demo-scale run.
 */
import { config } from "../shared/env.js";
import { CostLedger } from "../shared/cost.js";
import { connectStats, connectWarehouse } from "../harness/mcp-client.js";
import { newClient } from "../harness/loop.js";
import { runBandit, type BanditResult } from "../decisioning/bandit.js";
import { Memory } from "../memory/store.js";
import { DEAD_END_VERDICTS, toInsight } from "../memory/insights.js";
import {
  bareLlmJudge,
  discoverCampaigns,
  seasonalityOpportunity,
  underservedOpportunity,
  verifyExperiment,
  type EngineOpts,
} from "./engine.js";
import { exploreHypotheses, type Probe } from "./explorer.js";
import { checkGroundedness } from "./groundedness.js";
import { prioritize, SCORE_FORMULA } from "./prioritize.js";
import type { EngineResult, Hypothesis, Opportunity } from "./types.js";

export type EngineStreamEvent =
  | { kind: "run_started"; goal: string; candidateCount: number }
  | { kind: "explorer_started"; probeCount: number }
  | { kind: "hypothesis_proposed"; hypothesis: Hypothesis; matchedProbe: boolean }
  | { kind: "planning"; text: string }
  | { kind: "memory_hit"; subject: string; claim: string }
  | { kind: "candidate_started"; key: string; title: string }
  | { kind: "candidate_verified"; opportunity: Opportunity }
  | { kind: "prioritizing"; acceptedCount: number; formula: string }
  | { kind: "cost"; usd: number }
  | { kind: "run_finished"; result: EngineResult; bandit: BanditResult };

export async function runEngineStreaming(
  goal: string,
  onEvent: (e: EngineStreamEvent) => void,
  opts: EngineOpts = {},
): Promise<EngineResult> {
  const wh = await connectWarehouse();
  const stats = await connectStats();
  const client = config.anthropicApiKey ? newClient() : null;
  if (opts.withBareLlmContrast && !client) throw new Error("ANTHROPIC_API_KEY is not set (add it to .env).");
  const explorerLedger = new CostLedger();
  const bareLlmLedger = new CostLedger();
  const groundedLedger = new CostLedger();
  const memory = opts.memory ? await Memory.open() : null;
  const totalUsd = () => explorerLedger.totalUsd() + bareLlmLedger.totalUsd() + groundedLedger.totalUsd();
  const withGroundedness = opts.withGroundedness ?? (Boolean(opts.withBareLlmContrast) && client != null);

  try {
    const campaigns = await discoverCampaigns(wh);
    const candidates: { probe: Probe; make: () => Promise<Opportunity> }[] = [
      ...campaigns.map((c) => ({
        probe: { key: c.campaign_id, title: c.name, kind: "experiment" as const },
        make: () => verifyExperiment(wh, stats, c),
      })),
      { probe: { key: "Q4_SURGE", title: "Double down on the Q4 order surge", kind: "seasonality" as const }, make: () => seasonalityOpportunity(wh, stats) },
      { probe: { key: "UNDERSERVED_WORKWEAR", title: "Underserved: new workwear buyers", kind: "segment" as const }, make: () => underservedOpportunity(wh) },
    ];
    onEvent({ kind: "run_started", goal, candidateCount: candidates.length });

    // STAGE 1 · Explorer (annotate/overflow only — never adds or removes probes).
    onEvent({ kind: "explorer_started", probeCount: candidates.length });
    const prior = memory ? await memory.getValid() : [];
    const explorer = await exploreHypotheses({
      client,
      ledger: explorerLedger,
      goal,
      campaigns,
      memory: prior.map((p) => ({ subject: p.subject, claim: p.claim })),
      probes: candidates.map((c) => c.probe),
      mode: opts.explorerMode,
    });
    const probeKeys = new Set(candidates.map((c) => c.probe.key));
    for (const h of [...explorer.matched, ...explorer.surplus]) {
      onEvent({ kind: "hypothesis_proposed", hypothesis: h, matchedProbe: probeKeys.has(h.key) });
    }
    const hypothesisByKey = new Map(explorer.matched.map((h) => [h.key, h]));
    onEvent({ kind: "planning", text: "Planning the investigation — scanning campaigns, segments, and the order time-series." });

    const opps: Opportunity[] = [];
    const skippedFromMemory: { subject: string; claim: string }[] = [];
    const verifyAndEmit = async (key: string, title: string, make: () => Promise<Opportunity>) => {
      onEvent({ kind: "candidate_started", key, title });
      const o = await make();
      const h = hypothesisByKey.get(o.key);
      if (h) o.hypothesis = { rationale: h.rationale, source: explorer.source };
      if (opts.withBareLlmContrast && client) {
        const b = await bareLlmJudge(client, bareLlmLedger, o);
        if (b) o.bareLlm = b;
      }
      if (o.accepted) {
        if (withGroundedness && client) {
          o.grounded = await checkGroundedness(client, groundedLedger, o);
          if (o.grounded.verdict === "demote") {
            o.accepted = false;
            o.score = 0;
          }
        } else {
          o.grounded = { verdict: "n/a", reason: "skipped (no API key or disabled)" };
        }
      }
      opps.push(o);
      onEvent({ kind: "candidate_verified", opportunity: o });
      onEvent({ kind: "cost", usd: Number(totalUsd().toFixed(4)) });
    };

    for (const cand of candidates) {
      const known = prior.find((p) => p.subject === cand.probe.key && DEAD_END_VERDICTS.has(p.verdict));
      if (known) {
        skippedFromMemory.push({ subject: cand.probe.key, claim: known.claim });
        onEvent({ kind: "memory_hit", subject: cand.probe.key, claim: known.claim });
        continue; // proven dead end — memory says don't re-litigate it
      }
      await verifyAndEmit(cand.probe.key, cand.probe.title, cand.make);
    }

    // STAGE 3 · Prioritize.
    const { ranked, rejected } = prioritize(opps);
    onEvent({ kind: "prioritizing", acceptedCount: ranked.length, formula: SCORE_FORMULA });

    if (memory) {
      const runId = opts.runId ?? `engine-${Date.now()}`;
      for (const o of opps) {
        try {
          await memory.write(toInsight(o, runId));
        } catch {
          /* gate rejection — ignore */
        }
      }
    }

    const costByStage = {
      explorer: explorerLedger.totalUsd(),
      bareLlm: bareLlmLedger.totalUsd(),
      groundedness: groundedLedger.totalUsd(),
    };
    const result: EngineResult = {
      goal,
      ranked,
      rejected,
      contrastUsd: totalUsd(),
      generatedFromSeed: config.seed,
      explorer: { source: explorer.source, surplus: explorer.surplus },
      skippedFromMemory,
      costByStage,
    };
    onEvent({ kind: "run_finished", result, bandit: runBandit(config.seed) });
    return result;
  } finally {
    await wh.close();
    await stats.close();
    memory?.close();
  }
}
