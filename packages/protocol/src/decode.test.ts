import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DecisionBundleSchema } from "./bundle.js";
import { DecodeError, decodeBundle } from "./decode.js";
import { VectorSchema } from "./vectors.js";

const here = dirname(fileURLToPath(import.meta.url));
const VECTORS_DIR = resolve(here, "../vectors");

const goodBundle = () =>
  VectorSchema.parse(JSON.parse(readFileSync(resolve(VECTORS_DIR, "01_delivered_eligible.json"), "utf8"))).bundle;

describe("golden vectors", () => {
  const files = readdirSync(VECTORS_DIR).filter((f) => f.endsWith(".json"));

  it("exist and have unique names", () => {
    expect(files.length).toBeGreaterThanOrEqual(9);
    const names = files.map((f) => VectorSchema.parse(JSON.parse(readFileSync(resolve(VECTORS_DIR, f), "utf8"))).name);
    expect(new Set(names).size).toBe(names.length);
  });

  it.each(files)("%s parses under VectorSchema and its bundle under DecisionBundleSchema", (f) => {
    const v = VectorSchema.parse(JSON.parse(readFileSync(resolve(VECTORS_DIR, f), "utf8")));
    expect(() => DecisionBundleSchema.parse(v.bundle)).not.toThrow();
    expect(v.bundle.bundle_id.length).toBeGreaterThan(0);
  });
});

describe("decodeBundle forward compatibility", () => {
  it("passes a fully-understood bundle through untouched", () => {
    const b = goodBundle();
    const { bundle, skipped } = decodeBundle(b);
    expect(skipped).toEqual([]);
    expect(bundle.campaigns.map((c) => c.campaign_id)).toEqual(b.campaigns.map((c) => c.campaign_id));
  });

  it("skips a campaign with an unknown operator and records the reason - never throws, never evaluates it", () => {
    const b = goodBundle() as unknown as { campaigns: Record<string, unknown>[] };
    b.campaigns = [
      ...b.campaigns,
      {
        ...b.campaigns[0],
        campaign_id: "c_from_the_future",
        eligibility: { column: "region", op: "matches_regex", value: ".*" },
      },
    ];
    const { bundle, skipped } = decodeBundle(b);
    expect(bundle.campaigns.map((c) => c.campaign_id)).toEqual(["c_cross_category", "c_second_purchase"]);
    expect(skipped).toHaveLength(1);
    expect(skipped[0]?.campaign_id).toBe("c_from_the_future");
    expect(skipped[0]?.reason).toMatch(/eligibility/);
  });

  it("skips a campaign with an unknown template", () => {
    const b = goodBundle() as unknown as { campaigns: Record<string, unknown>[] };
    const broken = structuredClone(b.campaigns[0]) as Record<string, unknown>;
    broken.campaign_id = "c_fullscreen_takeover";
    broken.arms = [{ arm_id: "x", template: "fullscreen_video", title: "", body: "", cta: "" }];
    b.campaigns = [...b.campaigns, broken];
    const { bundle, skipped } = decodeBundle(b);
    expect(bundle.campaigns).toHaveLength(2);
    expect(skipped[0]?.campaign_id).toBe("c_fullscreen_takeover");
  });

  it("strips unknown additive fields silently (old client, newer server)", () => {
    const b = goodBundle() as unknown as Record<string, unknown>;
    b.some_future_field = { anything: true };
    (b.campaigns as Record<string, unknown>[])[0]!.another_future_field = 7;
    const { bundle, skipped } = decodeBundle(b);
    expect(skipped).toEqual([]);
    expect(bundle.campaigns).toHaveLength(2);
  });

  it("throws DecodeError only when the envelope itself is unreadable", () => {
    expect(() => decodeBundle({ nonsense: true })).toThrow(DecodeError);
    expect(() => decodeBundle(null)).toThrow(DecodeError);
  });
});
