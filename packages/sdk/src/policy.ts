import type { Arm, PolicySnapshot } from "@lift/protocol";
import { Rng, betaSample } from "./rng.js";

/**
 * Device-side arm selection over the Beta posteriors shipped in the bundle.
 * Same Thompson sampling as the server's decisioning/policy.ts — the server
 * LEARNS the posteriors from campaign_sends; the device only SELECTS. Unknown
 * segment or arm falls back to the uniform Beta(1,1) prior.
 */
export function selectArm(policy: PolicySnapshot, segmentKey: string, arms: Arm[], rng: Rng): Arm {
  const posteriors = policy.segments[segmentKey];
  let best: Arm = arms[0]!;
  let bestTheta = -1;
  for (const arm of arms) {
    const p = posteriors?.[arm.arm_id] ?? { alpha: 1, beta: 1 };
    const theta = betaSample(rng, p.alpha, p.beta);
    if (theta > bestTheta) {
      bestTheta = theta;
      best = arm;
    }
  }
  return best;
}
