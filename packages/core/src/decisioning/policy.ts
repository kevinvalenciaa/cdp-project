import type { Rng } from "../shared/rng.js";

/**
 * The bandit's policy, extracted from the simulation loop so the same math can
 * run in two places:
 *   - server: learn posteriors from campaign_sends (delivery/posteriors.ts) and
 *     ship them in the decision bundle as a PolicySnapshot
 *   - device: @lift/sdk policy.ts selects an arm from the shipped snapshot
 *     (the sampling functions are copied there verbatim — the SDK cannot
 *     depend on core)
 *
 * runBandit() consumes this module and must produce byte-identical results to
 * the pre-extraction implementation (guarded by bandit.test.ts) — the RNG call
 * order is part of the contract.
 */

// --- Beta sampling via Gamma (Marsaglia–Tsang; shapes here are always >= 1) ---
export function gammaSample(rng: Rng, shape: number): number {
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

export function betaSample(rng: Rng, a: number, b: number): number {
  const ga = gammaSample(rng, a);
  const gb = gammaSample(rng, b);
  return ga / (ga + gb);
}

/** Beta(alpha, beta) posteriors per segment x variant. */
export interface PolicyState {
  segments: string[];
  variants: string[];
  alpha: number[][];
  beta: number[][];
}

/** Fresh uniform Beta(1,1) priors. */
export function initPolicy(segments: string[], variants: string[]): PolicyState {
  return {
    segments,
    variants,
    alpha: Array.from({ length: segments.length }, () => new Array<number>(variants.length).fill(1)),
    beta: Array.from({ length: segments.length }, () => new Array<number>(variants.length).fill(1)),
  };
}

/**
 * Thompson sampling: draw a rate per variant from its posterior, take the max.
 * Iterates variants in index order with strict-greater tie-breaking — that
 * ordering is load-bearing for byte-identical replay.
 */
export function selectVariant(state: PolicyState, segmentIdx: number, rng: Rng): number {
  let best = 0;
  let bestTheta = -1;
  for (let v = 0; v < state.variants.length; v++) {
    const theta = betaSample(rng, state.alpha[segmentIdx]![v]!, state.beta[segmentIdx]![v]!);
    if (theta > bestTheta) {
      bestTheta = theta;
      best = v;
    }
  }
  return best;
}

/** Record an observed reward for (segment, variant). */
export function update(state: PolicyState, segmentIdx: number, variantIdx: number, reward: 0 | 1): void {
  if (reward) state.alpha[segmentIdx]![variantIdx]! += 1;
  else state.beta[segmentIdx]![variantIdx]! += 1;
}

/** Exploit-only readout: highest posterior mean per segment. */
export function posteriorBest(state: PolicyState): number[] {
  return state.alpha.map((aRow, s) => {
    let best = 0;
    let bestMean = -1;
    for (let v = 0; v < state.variants.length; v++) {
      const mean = aRow[v]! / (aRow[v]! + state.beta[s]![v]!);
      if (mean > bestMean) {
        bestMean = mean;
        best = v;
      }
    }
    return best;
  });
}
