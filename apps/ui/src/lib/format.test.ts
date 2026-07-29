import { describe, expect, it } from "vitest";
import board from "../../public/board.json";
import type { Opportunity } from "./types";
import {
  confidenceLabel,
  controlRate,
  impactBasis,
  isSignificant,
  liftMultiple,
  monthlyImpact,
  pct,
  pctFromPercent,
  pp,
} from "./format";
import { intervalTone } from "@/components/opportunity/LiftIntervalBar";

const ranked = board.opportunities.ranked as unknown as Opportunity[];
const rejected = (board.opportunities.rejected ?? []) as unknown as Opportunity[];

/**
 * These tests exist because the UI once rendered "Converts 1306.8% vs 1299.9% holdout".
 * `pct()` multiplies by 100 and was applied to `rawConversion`, which is already in percent,
 * while `upliftPp` was divided by 100 before being subtracted from it. The product's entire
 * thesis is causal credibility, so a nonsense rate on the evidence panel is a critical defect.
 */
describe("unit conventions", () => {
  it("pct() converts a FRACTION to a percentage", () => {
    expect(pct(0.1675)).toBe("16.8%");
    expect(pct(0.0818)).toBe("8.2%");
  });

  it("pctFromPercent() leaves a PERCENT value alone", () => {
    expect(pctFromPercent(13.068181818)).toBe("13.1%");
    expect(pctFromPercent(6.122)).toBe("6.1%");
  });

  it("pp() formats a percentage-POINT difference with an explicit sign", () => {
    expect(pp(6.945)).toBe("+6.9pp");
    expect(pp(-0.16)).toBe("-0.2pp");
  });

  it("does not confuse the two scales — the regression that shipped", () => {
    const treatment = 13.068181818; // percent
    const upliftPp = 6.945732838; // percentage points

    const correct = treatment - upliftPp;
    const buggy = treatment - upliftPp / 100;

    expect(pctFromPercent(correct)).toBe("6.1%");
    expect(pct(buggy)).toBe("1299.9%"); // what users actually saw
  });
});

describe("controlRate", () => {
  it("subtracts percentage points from a percent rate", () => {
    const o = ranked[0]!;
    expect(controlRate(o)).toBeCloseTo(o.rawConversion! - o.upliftPp!, 10);
  });

  it("returns null when either input is missing", () => {
    expect(controlRate({ rawConversion: null, upliftPp: 5 } as Opportunity)).toBeNull();
    expect(controlRate({ rawConversion: 10, upliftPp: null } as Opportunity)).toBeNull();
  });

  it("never returns a negative rate", () => {
    expect(controlRate({ rawConversion: 2, upliftPp: 9 } as Opportunity)).toBe(0);
  });
});

describe("every opportunity in the fixture renders a believable rate", () => {
  const withRates = [...ranked, ...rejected].filter((o) => o.rawConversion != null && o.upliftPp != null);

  it("has candidates to check", () => {
    expect(withRates.length).toBeGreaterThan(0);
  });

  it.each(withRates.map((o) => [o.key, o] as const))("%s: treatment rate is within 0–100%%", (_key, o) => {
    expect(o.rawConversion!).toBeGreaterThanOrEqual(0);
    expect(o.rawConversion!).toBeLessThanOrEqual(100);
  });

  it.each(withRates.map((o) => [o.key, o] as const))("%s: holdout rate is within 0–100%%", (_key, o) => {
    const control = controlRate(o)!;
    expect(control).toBeGreaterThanOrEqual(0);
    expect(control).toBeLessThanOrEqual(100);
  });

  it.each(withRates.map((o) => [o.key, o] as const))("%s: rendered strings never exceed 100%%", (_key, o) => {
    for (const s of [pctFromPercent(o.rawConversion!), pctFromPercent(controlRate(o)!)]) {
      expect(Number.parseFloat(s)).toBeLessThanOrEqual(100);
    }
  });
});

describe("accepted opportunities are visually distinguishable from their holdout", () => {
  const accepted = ranked.filter((o) => o.accepted && o.rawConversion != null && o.upliftPp != null);

  it.each(accepted.map((o) => [o.key, o] as const))("%s: treatment beats holdout", (_key, o) => {
    expect(o.rawConversion!).toBeGreaterThan(controlRate(o)!);
  });

  /**
   * The bug did not just print wrong numbers — it made the holdout bar 99.5% the height of
   * treatment, so a 2.1x effect looked like no effect at all. Guard the visual, not just the text.
   */
  it.each(accepted.map((o) => [o.key, o] as const))("%s: holdout bar is visibly shorter", (_key, o) => {
    const ratio = controlRate(o)! / o.rawConversion!;
    expect(ratio).toBeLessThan(0.95);
  });
});

describe("liftMultiple", () => {
  it("reports how many times treatment beats holdout", () => {
    expect(liftMultiple(ranked[0]!)).toBeCloseTo(13.068181818 / 6.122448979, 3);
  });

  it("returns null when the holdout rate is zero", () => {
    expect(liftMultiple({ rawConversion: 5, upliftPp: 5 } as Opportunity)).toBeNull();
  });
});

describe("significance", () => {
  it("treats a CI that excludes zero as significant", () => {
    expect(isSignificant({ ci: [2.8, 11.1] } as Opportunity)).toBe(true);
    expect(isSignificant({ ci: [-11.1, -2.8] } as Opportunity)).toBe(true);
  });

  it("treats a CI that straddles zero as not significant", () => {
    expect(isSignificant({ ci: [-7.7, 7.4] } as Opportunity)).toBe(false);
  });

  it("treats a missing CI as not significant", () => {
    expect(isSignificant({ ci: null } as Opportunity)).toBe(false);
  });

  it("agrees with the interval bar's tone", () => {
    expect(intervalTone([2.8, 11.1])).toBe("positive");
    expect(intervalTone([-11.1, -2.8])).toBe("negative");
    expect(intervalTone([-7.7, 7.4])).toBe("inconclusive");
    expect(intervalTone(null)).toBe("inconclusive");
  });

  it("classifies the planted trap as inconclusive", () => {
    const trap = rejected.find((o) => o.key === "VIP_LOYALTY_BLAST");
    expect(trap).toBeDefined();
    expect(isSignificant(trap!)).toBe(false);
    expect(intervalTone(trap!.ci)).toBe("inconclusive");
  });
});

describe("confidenceLabel", () => {
  it("expresses a p-value as confidence, capped at 99%", () => {
    expect(confidenceLabel({ pValue: 0.007 } as Opportunity)).toBe("99% confidence");
    expect(confidenceLabel({ pValue: 0.041 } as Opportunity)).toBe("95% confidence");
    expect(confidenceLabel({ pValue: 0.0001 } as Opportunity)).toBe("99% confidence");
  });

  it("returns null without a p-value", () => {
    expect(confidenceLabel({ pValue: null } as Opportunity)).toBeNull();
  });
});

describe("monthlyImpact and its stated basis", () => {
  it("is reach x uplift x value", () => {
    const o = ranked[0]!;
    expect(monthlyImpact(o)).toBeCloseTo(o.reach * (o.upliftPp! / 100) * o.value, 6);
  });

  it("is zero when uplift is unknown", () => {
    expect(monthlyImpact({ upliftPp: null, reach: 900, value: 100 } as Opportunity)).toBe(0);
  });

  it("never goes negative", () => {
    expect(monthlyImpact({ upliftPp: -5, reach: 900, value: 100 } as Opportunity)).toBe(0);
  });

  it("states inputs a reader can multiply back to the headline", () => {
    const basis = impactBasis(ranked[0]!);
    expect(basis).toContain("900 customers");
    expect(basis).toContain("+6.9pp");
  });
});
