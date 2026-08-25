import { Rng } from "../shared/rng.js";
import { initPolicy, posteriorBest, selectVariant, update } from "./policy.js";

/**
 * AI-Decisioning analog - a contextual Thompson-sampling bandit that learns the best
 * message variant PER SEGMENT from outcomes. This is RL/optimization over delivery, and
 * is kept in its OWN module, deliberately separate from the context-engineering harness -
 * keeping decisioning separate from the agent harness.
 *
 * Measurement mirrors AI Decisioning: lift vs a random holdout, and vs a naive best-on-
 * average ("human marketing") baseline.
 *
 * The policy itself (posteriors + Thompson selection + update) lives in policy.ts so the
 * delivery bundle can ship it to devices; this file is the simulation harness around it.
 */

export interface BanditScenario {
  segments: { name: string; weight: number }[];
  variants: string[];
  /** true conversion rate[segment][variant] (the planted optimum the bandit must learn). */
  trueRate: number[][];
}

/** Different variants win in different segments → personalization (bandit) beats global-best. */
export const SCENARIO: BanditScenario = {
  segments: [
    { name: "vip", weight: 0.2 },
    { name: "mid", weight: 0.5 },
    { name: "low", weight: 0.3 },
  ],
  variants: ["exclusive_access", "social_proof", "urgency"],
  trueRate: [
    [0.3, 0.18, 0.12], // vip → exclusive_access
    [0.1, 0.16, 0.12], // mid → social_proof
    [0.06, 0.08, 0.14], // low → urgency
  ],
};

export interface BanditResult {
  impressions: number;
  learnedBest: string[]; // best variant per segment the bandit converged to
  oracleBest: string[]; // the true best variant per segment
  converged: boolean;
  banditRate: number; // realized conversion rate
  randomRate: number; // random-variant holdout (no optimization)
  globalBestRate: number; // best single variant for everyone ("human marketing")
  oracleRate: number; // upper bound (always-optimal)
  liftVsHoldout: number; // bandit vs random
  liftVsGlobalBest: number; // bandit vs best-on-average
  globalBestVariant: string;
}

function pickSegment(rng: Rng, s: BanditScenario): number {
  let r = rng.next();
  for (let i = 0; i < s.segments.length; i++) {
    r -= s.segments[i]!.weight;
    if (r <= 0) return i;
  }
  return s.segments.length - 1;
}

export function runBandit(seed: number, scenario: BanditScenario = SCENARIO, impressions = 6000): BanditResult {
  const rng = new Rng(seed);
  const S = scenario.segments.length;
  const V = scenario.variants.length;
  const policy = initPolicy(
    scenario.segments.map((s) => s.name),
    scenario.variants,
  );
  let conversions = 0;

  for (let t = 0; t < impressions; t++) {
    const seg = pickSegment(rng, scenario);
    const best = selectVariant(policy, seg, rng);
    const reward = rng.next() < scenario.trueRate[seg]![best]! ? 1 : 0;
    conversions += reward;
    update(policy, seg, best, reward as 0 | 1);
  }

  // Final learned policy: highest posterior mean per segment.
  const learnedBestIdx = posteriorBest(policy);
  const oracleBestIdx = scenario.trueRate.map((row) => row.indexOf(Math.max(...row)));

  // Baselines (expected rates over the segment mix).
  const expected = (variantPerSeg: number[]) =>
    scenario.segments.reduce((sum, seg, s) => sum + seg.weight * scenario.trueRate[s]![variantPerSeg[s]!]!, 0);
  const randomRate = scenario.segments.reduce(
    (sum, seg, s) => sum + seg.weight * (scenario.trueRate[s]!.reduce((a, b) => a + b, 0) / V),
    0,
  );
  const variantAvg = scenario.variants.map((_, v) => scenario.segments.reduce((sum, seg, s) => sum + seg.weight * scenario.trueRate[s]![v]!, 0));
  const globalBestVariantIdx = variantAvg.indexOf(Math.max(...variantAvg));
  const globalBestRate = expected(new Array(S).fill(globalBestVariantIdx));
  const oracleRate = expected(oracleBestIdx);
  const banditRate = conversions / impressions;

  return {
    impressions,
    learnedBest: learnedBestIdx.map((v) => scenario.variants[v]!),
    oracleBest: oracleBestIdx.map((v) => scenario.variants[v]!),
    converged: learnedBestIdx.every((v, s) => v === oracleBestIdx[s]),
    banditRate,
    randomRate,
    globalBestRate,
    oracleRate,
    liftVsHoldout: banditRate / randomRate - 1,
    liftVsGlobalBest: banditRate / globalBestRate - 1,
    globalBestVariant: scenario.variants[globalBestVariantIdx]!,
  };
}
