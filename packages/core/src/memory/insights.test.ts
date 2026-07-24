import { describe, expect, it } from "vitest";
import { toInsight, subjectType, DEAD_END_VERDICTS } from "./insights.js";
import type { Opportunity } from "../engine/types.js";

function opp(over: Partial<Opportunity>): Opportunity {
  return {
    key: "K",
    title: "T",
    segment: "seg",
    type: "experiment",
    reach: 100,
    value: 10,
    rawConversion: null,
    upliftPp: 6.2,
    ci: null,
    pValue: 0.041,
    verdict: "real_lift",
    accepted: true,
    score: 1,
    reason: "",
    naiveClaim: null,
    evidence: { conv_t: 1 },
    provenance: { queries: [{ sql: "SELECT 1", resultHash: "abc", fingerprint: "f1" }], stats: null },
    ...over,
  };
}

describe("toInsight", () => {
  it("verified wins carry the lift + p-value claim", () => {
    const i = toInsight(opp({}), "run-1");
    expect(i.claim).toContain("+6.2pp");
    expect(i.claim).toContain("p=0.041");
    expect(i.verdict).toBe("real_lift");
  });

  it("dead-end verdicts get the not-persuadable / seasonal claims", () => {
    expect(toInsight(opp({ accepted: false, verdict: "no_significant_lift" }), "r").claim).toContain("not persuadable");
    expect(toInsight(opp({ accepted: false, verdict: "explained_by_seasonality", type: "seasonality" }), "r").claim).toContain("seasonal pattern");
    expect(toInsight(opp({ accepted: false, verdict: "needs_test", type: "segment" }), "r").claim).toContain("designed holdout");
  });

  it("evidence embeds runIds + query fingerprints (traceable memory)", () => {
    const parsed = JSON.parse(toInsight(opp({}), "run-9").evidence);
    expect(parsed.runIds).toEqual(["run-9"]);
    expect(parsed.fingerprints).toEqual(["f1"]);
    expect(parsed.conv_t).toBe(1);
  });

  it("subjectType maps experiment→campaign, seasonality→initiative, segment→audience", () => {
    expect(subjectType(opp({}))).toBe("campaign");
    expect(subjectType(opp({ type: "seasonality" }))).toBe("initiative");
    expect(subjectType(opp({ type: "segment" }))).toBe("audience");
  });

  it("DEAD_END_VERDICTS covers exactly the two settled negatives", () => {
    expect([...DEAD_END_VERDICTS].sort()).toEqual(["explained_by_seasonality", "no_significant_lift"]);
  });
});
