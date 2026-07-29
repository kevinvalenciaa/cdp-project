import { describe, expect, it } from "vitest";
import { prioritize, scoreOpportunity } from "./prioritize.js";
import type { Opportunity } from "./types.js";

function opp(key: string, over: Partial<Opportunity> = {}): Opportunity {
  return {
    key,
    title: key,
    segment: "seg",
    type: "experiment",
    reach: 100,
    value: 10,
    rawConversion: null,
    upliftPp: null,
    ci: null,
    pValue: null,
    verdict: "needs_test",
    accepted: false,
    score: 0,
    reason: "",
    naiveClaim: null,
    evidence: {},
    provenance: { queries: [], stats: null },
    ...over,
  };
}

describe("scoreOpportunity", () => {
  it("is reach × value × absLift for accepted opportunities", () => {
    expect(scoreOpportunity({ reach: 100, value: 10, accepted: true }, 0.05)).toBeCloseTo(50);
  });

  it("is 0 for rejected opportunities regardless of lift", () => {
    expect(scoreOpportunity({ reach: 100, value: 10, accepted: false }, 0.5)).toBe(0);
  });

  it("clamps negative lift to 0", () => {
    expect(scoreOpportunity({ reach: 100, value: 10, accepted: true }, -0.2)).toBe(0);
  });
});

describe("prioritize", () => {
  it("ranks accepted by score desc and tiers rejected by reach×value desc", () => {
    const a = opp("A", { accepted: true, score: 10, verdict: "real_lift" });
    const b = opp("B", { accepted: true, score: 99, verdict: "real_lift" });
    const c = opp("C", { reach: 1000, value: 100 }); // big stakes, rejected
    const d = opp("D", { reach: 10, value: 1 });
    const { ranked, rejected } = prioritize([a, c, d, b]);
    expect(ranked.map((o) => o.key)).toEqual(["B", "A"]);
    expect(rejected.map((o) => o.key)).toEqual(["C", "D"]);
  });

  it("is completion-order-proof: equal scores tiebreak by key, whatever the input order", () => {
    const mk = () => [opp("Z", { accepted: true, score: 5, verdict: "real_lift" }), opp("A", { accepted: true, score: 5, verdict: "real_lift" })];
    const fwd = prioritize(mk());
    const rev = prioritize(mk().reverse());
    expect(fwd.ranked.map((o) => o.key)).toEqual(["A", "Z"]);
    expect(rev.ranked.map((o) => o.key)).toEqual(["A", "Z"]);
  });
});
