/**
 * Deterministic PRNG + Beta sampling, COPIED from @lift/core (shared/rng.ts and
 * decisioning/policy.ts) rather than imported: the SDK's only dependency is
 * @lift/protocol, and core drags @duckdb/node-api which cannot load in Hermes.
 * The math must stay byte-for-byte identical to core's - same mulberry32, same
 * Box–Muller, same Marsaglia–Tsang - so a device and the server sampling the
 * same posteriors with the same seed pick the same arm.
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

  /** Standard-normal-ish via Box–Muller. */
  normal(mean = 0, sd = 1): number {
    let u = 0;
    let v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return mean + z * sd;
  }
}

// --- Beta sampling via Gamma (Marsaglia–Tsang; shapes here are always >= 1) ---
export function gammaSample(rng: Rng, shape: number): number {
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    const x = rng.normal();
    const v = (1 + c * x) ** 3;
    if (v <= 0) continue;
    const u = rng.next();
    if (u < 1 - 0.0331 * x ** 4) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

export function betaSample(rng: Rng, a: number, b: number): number {
  const ga = gammaSample(rng, a);
  const gb = gammaSample(rng, b);
  return ga / (ga + gb);
}

/** FNV-1a - stable string hash for holdout assignment and deterministic seeds. */
export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
