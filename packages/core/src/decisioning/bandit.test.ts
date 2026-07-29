import { describe, expect, it } from "vitest";
import { SCENARIO, runBandit } from "./bandit.js";

describe("Thompson-sampling bandit", () => {
  it("converges to the best variant per segment and beats both baselines", () => {
    const r = runBandit(42);
    expect(r.converged).toBe(true);
    expect(r.learnedBest).toEqual(r.oracleBest);
    expect(r.liftVsHoldout).toBeGreaterThan(0);
    expect(r.liftVsGlobalBest).toBeGreaterThan(0);
    // bandit should approach the oracle and beat the global-best
    expect(r.banditRate).toBeGreaterThan(r.globalBestRate);
    expect(r.banditRate).toBeLessThanOrEqual(r.oracleRate + 0.01);
  });

  it("is deterministic for a seed", () => {
    expect(runBandit(7).banditRate).toBe(runBandit(7).banditRate);
  });

  it("the planted scenario has different winners per segment (so personalization helps)", () => {
    const winners = SCENARIO.trueRate.map((row) => row.indexOf(Math.max(...row)));
    expect(new Set(winners).size).toBeGreaterThan(1);
  });

  it("is byte-identical to the pre-extraction implementation for seed 42", () => {
    // Frozen output of runBandit(42) captured BEFORE the policy extraction
    // (initPolicy/selectVariant/update/posteriorBest). The RNG call order is
    // part of the refactor contract — any drift here means the extraction
    // changed behaviour, not just structure.
    const reference =
      '{"impressions":6000,"learnedBest":["exclusive_access","social_proof","urgency"],"oracleBest":["exclusive_access","social_proof","urgency"],"converged":true,"banditRate":0.1675,"randomRate":0.13133333333333333,"globalBestRate":0.13999999999999999,"oracleRate":0.18200000000000002,"liftVsHoldout":0.27538071065989866,"liftVsGlobalBest":0.19642857142857162,"globalBestVariant":"social_proof"}';
    expect(JSON.stringify(runBandit(42))).toBe(reference);
  });
});
