import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { CostLedger } from "../shared/cost.js";
import { checkGroundedness } from "./groundedness.js";
import type { Opportunity } from "./types.js";

const OPP: Opportunity = {
  key: "X",
  title: "X",
  segment: "seg",
  type: "experiment",
  reach: 900,
  value: 186,
  rawConversion: 13,
  upliftPp: 6.9,
  ci: [2.7, 11.1],
  pValue: 0.008,
  verdict: "real_lift",
  accepted: true,
  score: 100,
  reason: "Significant +6.9% incremental lift",
  naiveClaim: "claim",
  evidence: { conv_t: 92, n_t: 705, conv_c: 12, n_c: 195 },
  provenance: { queries: [], stats: null },
};

function stubClient(texts: string[]): Anthropic {
  let i = 0;
  return {
    messages: {
      create: async () => ({
        model: "claude-haiku-4-5-20251001",
        usage: { input_tokens: 10, output_tokens: 10 },
        content: [{ type: "text", text: texts[Math.min(i++, texts.length - 1)] }],
      }),
    },
  } as unknown as Anthropic;
}

describe("checkGroundedness", () => {
  it("passes when the model confirms the claim is grounded", async () => {
    const r = await checkGroundedness(stubClient(['{"grounded": true, "reason": "matches"}']), new CostLedger(), OPP);
    expect(r.verdict).toBe("pass");
  });

  it("demotes when the model finds the claim ungrounded", async () => {
    const r = await checkGroundedness(stubClient(['{"grounded": false, "reason": "numbers do not match"}']), new CostLedger(), OPP);
    expect(r.verdict).toBe("demote");
    expect(r.reason).toContain("match");
  });

  it("retries once, then fails closed (demote) on unparseable output", async () => {
    const r = await checkGroundedness(stubClient(["not json", "still not json"]), new CostLedger(), OPP);
    expect(r.verdict).toBe("demote");
    expect(r.reason).toContain("demoting to be safe");
  });

  it("recovers if the retry parses", async () => {
    const r = await checkGroundedness(stubClient(["not json", '{"grounded": true, "reason": "ok"}']), new CostLedger(), OPP);
    expect(r.verdict).toBe("pass");
  });
});
