import type { Opportunity } from "./types.js";

/**
 * The Prioritizer stage - deliberately plain arithmetic, not an LLM. The ranking must be
 * inspectable and defensible number-by-number, so the formula lives here in one place:
 *
 *   score = reach × value × max(0, verified absolute lift)
 *
 * "Verified" is the load-bearing word: absLift comes from the holdout test, so the third
 * factor is causal (would NOT have happened anyway), a sharpening of reach × value ×
 * likelihood. Opportunities the Verifier did not accept score 0 - nothing unproven ranks.
 */
export const SCORE_FORMULA = "reach × value × verified uplift";

export function scoreOpportunity(o: { reach: number; value: number; accepted: boolean }, absLift: number): number {
  return o.accepted ? o.reach * o.value * Math.max(0, absLift) : 0;
}

/**
 * Rank accepted opportunities by score; tier the rejected by reach × value (what was at
 * stake had the claim been real - the most tempting traps surface first, which is exactly
 * what the contrast demo wants on top). Key-ascending tiebreak keeps ordering stable no
 * matter which parallel verification finished first.
 */
export function prioritize(opps: Opportunity[]): { ranked: Opportunity[]; rejected: Opportunity[] } {
  const byKey = (a: Opportunity, b: Opportunity) => a.key.localeCompare(b.key);
  const ranked = opps
    .filter((o) => o.accepted)
    .sort((a, b) => b.score - a.score || byKey(a, b));
  const rejected = opps
    .filter((o) => !o.accepted)
    .sort((a, b) => b.reach * b.value - a.reach * a.value || byKey(a, b));
  return { ranked, rejected };
}
