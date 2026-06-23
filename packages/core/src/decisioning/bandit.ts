import { Rng } from "../shared/rng.js";

/**
 * AI-Decisioning analog — a contextual Thompson-sampling bandit that learns the best
 * message variant PER SEGMENT from outcomes. This is RL/optimization over delivery, and
 * is kept in its OWN module, deliberately separate from the context-engineering harness —
 * mirroring how Hightouch's AI Decisioning is a separate product from their agent harness.
 *
 * Measurement mirrors AI Decisioning: lift vs a random holdout, and vs a naive best-on-
 * average ("human marketing") baseline.
 */

// --- Beta sampling via Gamma (Marsaglia–Tsang; shapes here are always >= 1) ---
function gammaSample(rng: Rng, shape: number): number {
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    const x = rng.normal();
    const v = (1 + c * x) ** 3;
    if (v <= 0) continue;
    const u = rng.next();
    if (u < 1 - 0.0331 * x ** 4) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}
function betaSample(rng: Rng, a: number, b: number): number {
  const ga = gammaSample(rng, a);
  const gb = gammaSample(rng, b);
  return ga / (ga + gb);
}

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
  const alpha = Array.from({ length: S }, () => new Array(V).fill(1));
  const beta = Array.from({ length: S }, () => new Array(V).fill(1));
  let conversions = 0;

  for (let t = 0; t < impressions; t++) {
    const seg = pickSegment(rng, scenario);
    // Thompson: sample a rate per variant, choose the best.
    let best = 0;
    let bestTheta = -1;
    for (let v = 0; v < V; v++) {
      const theta = betaSample(rng, alpha[seg]![v]!, beta[seg]![v]!);
      if (theta > bestTheta) {
        bestTheta = theta;
        best = v;
      }
    }
    const reward = rng.next() < scenario.trueRate[seg]![best]! ? 1 : 0;
    conversions += reward;
    if (reward) alpha[seg]![best]! += 1;
    else beta[seg]![best]! += 1;
  }

  // Final learned policy: highest posterior mean per segment.
  const learnedBestIdx = alpha.map((aRow, s) => {
    let best = 0;
    let bestMean = -1;
    for (let v = 0; v < V; v++) {
      const mean = aRow[v]! / (aRow[v]! + beta[s]![v]!);
      if (mean > bestMean) {
        bestMean = mean;
        best = v;
      }
    }
    return best;
  });
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
