import { Rng } from "../shared/rng.js";

export interface SimulatedOutcome {
  treatmentN: number;
  controlN: number;
  treatmentConv: number;
  controlConv: number;
  trueTreatmentRate: number;
  trueControlRate: number;
}

/**
 * Simulate a fresh holdout test on an activated audience, drawing conversions from known
 * "true" rates (from the original experiment) with light noise. This closes the loop:
 * after we draft + activate, we MEASURE the incremental lift against a control — the same
 * holdout discipline AI Decisioning uses. Deterministic given the seed.
 */
export function simulateActivationOutcome(
  seed: number,
  persuadableReach: number,
  trueTreatmentRate: number,
  trueControlRate: number,
  holdoutFraction = 0.2,
): SimulatedOutcome {
  const rng = new Rng(seed + 7);
  const nTotal = Math.max(50, Math.min(persuadableReach, 4000));
  const controlN = Math.round(nTotal * holdoutFraction);
  const treatmentN = nTotal - controlN;
  const treatmentConv = Math.max(0, Math.round(treatmentN * trueTreatmentRate) + rng.int(-2, 2));
  const controlConv = Math.max(0, Math.round(controlN * trueControlRate) + rng.int(-1, 1));
  return { treatmentN, controlN, treatmentConv, controlConv, trueTreatmentRate, trueControlRate };
}
