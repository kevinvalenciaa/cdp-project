import { describe, expect, it } from "vitest";
import { Rng } from "./rng.js";

describe("Rng determinism", () => {
  it("produces an identical sequence for the same seed", () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const seqA = Array.from({ length: 8 }, () => a.next());
    const seqB = Array.from({ length: 8 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("produces a different sequence for a different seed", () => {
    expect(new Rng(1).next()).not.toBe(new Rng(2).next());
  });

  it("shuffle is deterministic for a seed and is a permutation", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const s1 = new Rng(7).shuffle(items);
    const s2 = new Rng(7).shuffle(items);
    expect(s1).toEqual(s2);
    expect([...s1].sort((x, y) => x - y)).toEqual(items);
  });

  it("int respects bounds", () => {
    const r = new Rng(99);
    for (let i = 0; i < 200; i++) {
      const v = r.int(3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
    }
  });
});
