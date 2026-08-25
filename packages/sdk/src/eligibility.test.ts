import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { VectorSchema, type DecisionBundle } from "@lift/protocol";
import { evaluateBundle } from "./eligibility.js";

/** Targeted cases the golden vectors do not cover. */

const here = dirname(fileURLToPath(import.meta.url));
const base = (): { bundle: DecisionBundle; clock: { wallMs: number; monotonicMs: number; bootId: string; skewMs: number } } => {
  const v = VectorSchema.parse(
    JSON.parse(readFileSync(resolve(here, "../../protocol/vectors/01_delivered_eligible.json"), "utf8")),
  );
  return { bundle: v.bundle, clock: v.clock };
};

const ctx = (attrs: Record<string, string | number | boolean>) => ({
  userId: "u1",
  deviceId: "d1",
  sessionId: "s1",
  surface: "home_hero",
  attrs,
  seed: 42,
});

describe("attr:-prefixed segment_key resolves per user", () => {
  it("keys posteriors by the user's attribute value", () => {
    const { bundle, clock } = base();
    const b: DecisionBundle = {
      ...bundle,
      campaigns: bundle.campaigns.map((c) => ({ ...c, segment_key: "attr:value_tier" })),
      policy: {
        segments: {
          // vip strongly favours arm_b; mid strongly favours arm_a - degenerate
          // posteriors so the assertion is implementation-independent.
          vip: { arm_a: { alpha: 1, beta: 1000 }, arm_b: { alpha: 1000, beta: 1 } },
          mid: { arm_a: { alpha: 1000, beta: 1 }, arm_b: { alpha: 1, beta: 1000 } },
        },
      },
    };
    const vip = evaluateBundle(b, ctx({ is_one_time_buyer: true, categories_purchased: 1, value_tier: "vip" }), [], clock);
    const mid = evaluateBundle(b, ctx({ is_one_time_buyer: true, categories_purchased: 1, value_tier: "mid" }), [], clock);
    expect(vip.arm_id).toBe("arm_b");
    expect(mid.arm_id).toBe("arm_a");
  });

  it("an unknown tier falls back to uniform priors without crashing", () => {
    const { bundle, clock } = base();
    const b: DecisionBundle = {
      ...bundle,
      campaigns: bundle.campaigns.map((c) => ({ ...c, segment_key: "attr:value_tier" })),
    };
    const d = evaluateBundle(b, ctx({ is_one_time_buyer: true, categories_purchased: 1, value_tier: "brand_new_tier" }), [], clock);
    expect(d.outcome).toBe("delivered");
    expect(d.arm_id).not.toBeNull();
  });
});
