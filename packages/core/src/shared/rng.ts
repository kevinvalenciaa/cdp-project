/**
 * Deterministic, seedable PRNG (mulberry32) + sampling helpers.
 * Determinism is load-bearing: the synthetic warehouse, the planted ground truth,
 * and the outcome simulator must reproduce identically from a seed so the demo is
 * replayable and every claim is checkable against GROUND_TRUTH.md.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Float in [min, max). */
  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** True with probability p. */
  bool(p: number): boolean {
    return this.next() < p;
  }

  /** Uniform pick from an array. */
  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error("pick from empty array");
    return arr[this.int(0, arr.length - 1)] as T;
  }

  /** Weighted pick. */
  weighted<T>(items: readonly { item: T; weight: number }[]): T {
    const total = items.reduce((s, i) => s + i.weight, 0);
    let r = this.next() * total;
    for (const i of items) {
      r -= i.weight;
      if (r <= 0) return i.item;
    }
    return items[items.length - 1]!.item;
  }

  /** Deterministic Fisher–Yates shuffle (returns a new array). */
  shuffle<T>(arr: readonly T[]): T[] {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [out[i], out[j]] = [out[j] as T, out[i] as T];
    }
    return out;
  }

  /** Standard-normal-ish via Box–Muller. */
  normal(mean = 0, sd = 1): number {
    let u = 0;
    let v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return mean + z * sd;
  }

  /** Clamp helper. */
  static clamp(x: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, x));
  }
}
