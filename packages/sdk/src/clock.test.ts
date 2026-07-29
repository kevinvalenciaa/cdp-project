import { describe, expect, it } from "vitest";
import { computeSkewMs, elapsedMs, parseWindowMs, type Clock } from "./clock.js";

const D = 86_400_000;
const H = 3_600_000;
const BASE = 1_750_000_000_000;

const clock = (over: Partial<Clock> = {}): Clock => ({ wallMs: BASE, monotonicMs: D, bootId: "b1", skewMs: 0, ...over });

describe("parseWindowMs", () => {
  it("parses the ISO-8601 duration subset", () => {
    expect(parseWindowMs("P7D")).toBe(7 * D);
    expect(parseWindowMs("PT24H")).toBe(24 * H);
    expect(parseWindowMs("PT30M")).toBe(30 * 60_000);
    expect(parseWindowMs("P1DT12H")).toBe(D + 12 * H);
    expect(parseWindowMs("session")).toBe("session");
  });

  it("rejects garbage and zero-length windows", () => {
    expect(() => parseWindowMs("7 days")).toThrow();
    expect(() => parseWindowMs("P")).toThrow();
  });
});

describe("elapsedMs — the adversarial-clock rules", () => {
  it("same boot: monotonic elapsed is authoritative, wall clock is ignored", () => {
    // Wall clock says 8 days passed; monotonic says one hour. Same boot -> 1h.
    const now = clock({ wallMs: BASE + 8 * D });
    expect(elapsedMs(now, { wall_ms: BASE - H, monotonic_ms: D - H, boot_id: "b1" })).toBe(H);
  });

  it("cross-boot: falls back to skew-corrected wall time", () => {
    const now = clock({ skewMs: 2_000 });
    expect(elapsedMs(now, { wall_ms: BASE - 2 * H, monotonic_ms: null, boot_id: null })).toBe(2 * H + 2_000);
  });

  it("ambiguity (entry claims a future wall time) resolves to elapsed 0 — cap stays engaged", () => {
    // Device clock was rolled BACK past the entry: elapsed must not go negative
    // (which would eject the entry from every window and un-cap the user).
    const now = clock();
    expect(elapsedMs(now, { wall_ms: BASE + H, monotonic_ms: null, boot_id: "b0" })).toBe(0);
  });

  it("monotonic can never be negative either (defensive)", () => {
    const now = clock({ monotonicMs: 100 });
    expect(elapsedMs(now, { wall_ms: BASE, monotonic_ms: 500, boot_id: "b1" })).toBe(0);
  });
});

describe("computeSkewMs", () => {
  it("anchors skew off a server_time ISO string", () => {
    expect(computeSkewMs(BASE, new Date(BASE + 5_000).toISOString())).toBe(5_000);
    expect(computeSkewMs(BASE, new Date(BASE - 3_000).toISOString())).toBe(-3_000);
  });

  it("an unparseable server time contributes zero skew, never NaN", () => {
    expect(computeSkewMs(BASE, "not a timestamp")).toBe(0);
  });
});
