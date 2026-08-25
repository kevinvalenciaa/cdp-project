import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { CostLedger } from "../shared/cost.js";
import { exploreHypotheses, type Probe } from "./explorer.js";

const PROBES: Probe[] = [
  { key: "CAMP_A", title: "Campaign A", kind: "experiment" },
  { key: "Q4_SURGE", title: "Q4 surge", kind: "seasonality" },
];

const CAMPAIGNS = [{ campaign_id: "CAMP_A", name: "Campaign A", target_description: "everyone" }];

function stubClient(text: string): Anthropic {
  return {
    messages: {
      create: async () => ({
        model: "claude-haiku-4-5-20251001",
        usage: { input_tokens: 10, output_tokens: 10 },
        content: [{ type: "text", text }],
      }),
    },
  } as unknown as Anthropic;
}

describe("exploreHypotheses", () => {
  it("static mode is deterministic: one hypothesis per probe, no surplus", async () => {
    const out = await exploreHypotheses({
      client: null,
      ledger: new CostLedger(),
      goal: "g",
      campaigns: CAMPAIGNS,
      memory: [],
      probes: PROBES,
      mode: "static",
    });
    expect(out.source).toBe("static");
    expect(out.matched.map((h) => h.key)).toEqual(["CAMP_A", "Q4_SURGE"]);
    expect(out.surplus).toEqual([]);
  });

  it("llm mode binds by exact key, dedups, and overflows unknown keys to surplus", async () => {
    const text = JSON.stringify([
      { key: "CAMP_A", title: "A", rationale: "reason a", kind: "experiment" },
      { key: "CAMP_A", title: "dup", rationale: "dup", kind: "experiment" },
      { key: "NEW_IDEA", title: "New idea", rationale: "beyond probes", kind: "segment" },
    ]);
    const out = await exploreHypotheses({
      client: stubClient(text),
      ledger: new CostLedger(),
      goal: "g",
      campaigns: CAMPAIGNS,
      memory: [],
      probes: PROBES,
    });
    expect(out.source).toBe("llm");
    // CAMP_A annotated by the LLM (first wins), Q4_SURGE backfilled statically - never fewer probes.
    expect(out.matched.map((h) => h.key).sort()).toEqual(["CAMP_A", "Q4_SURGE"]);
    expect(out.matched.find((h) => h.key === "CAMP_A")?.rationale).toBe("reason a");
    expect(out.surplus.map((h) => h.key)).toEqual(["NEW_IDEA"]);
  });

  it("falls back to static on unparseable LLM output (never a smaller run)", async () => {
    const out = await exploreHypotheses({
      client: stubClient("I think you should try some campaigns!"),
      ledger: new CostLedger(),
      goal: "g",
      campaigns: CAMPAIGNS,
      memory: [],
      probes: PROBES,
    });
    expect(out.source).toBe("static");
    expect(out.matched).toHaveLength(PROBES.length);
  });
});
