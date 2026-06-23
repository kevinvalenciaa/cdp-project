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
});
