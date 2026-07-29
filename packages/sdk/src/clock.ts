/**
 * The clock is the hardest design decision in this SDK, so it gets its own file.
 *
 * evaluateBundle() must be PURE so the golden vectors are deterministic — which
 * means "now" is injected. But wall-clock "now" is exactly what the Settings
 * app (or DST, or a confused traveller) manipulates to defeat a P7D frequency
 * cap. You cannot have both purity and an adversarial clock unless time is a
 * VALUE with structure, not a number:
 *
 *   - wallMs      device wall clock. Display + last-resort fallback only.
 *   - monotonicMs ms since boot. Cannot be set backwards. Authoritative for
 *                 window arithmetic whenever the ledger entry shares bootId.
 *   - bootId      random id regenerated each boot, pairing monotonic stamps.
 *   - skewMs      serverTime - deviceWall from the last response's server_time
 *                 anchor (every response carries it — no extra round trip).
 *
 * Window rule: same boot -> monotonic elapsed. Across boots -> skew-corrected
 * wall elapsed. Ambiguous (entry claims a FUTURE wall time) -> elapsed 0, i.e.
 * treated as just-sent: the cap stays engaged. On ambiguity we suppress rather
 * than show — a user who fiddles with the date gets fewer messages, never more.
 */

export interface Clock {
  wallMs: number;
  monotonicMs: number;
  bootId: string;
  skewMs: number;
}

/** Provider of "now" — injectable so tests and vectors control time completely. */
export type ClockSource = () => Clock;

/** Parse "session" or the ISO-8601 duration subset used by caps (P7D, PT24H, PT30M, P1DT12H). */
export function parseWindowMs(window: string): number | "session" {
  if (window === "session") return "session";
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/.exec(window);
  if (!m) throw new Error(`unparseable cap window: ${window}`);
  const days = Number(m[1] ?? 0);
  const hours = Number(m[2] ?? 0);
  const mins = Number(m[3] ?? 0);
  const ms = days * 86_400_000 + hours * 3_600_000 + mins * 60_000;
  if (ms === 0) throw new Error(`zero-length cap window: ${window}`);
  return ms;
}

export interface TimedEntry {
  wall_ms: number;
  monotonic_ms: number | null;
  boot_id: string | null;
}

/**
 * Milliseconds since `entry` happened, as seen from `now`. Never negative:
 * a negative wall delta means the clock moved backwards past the entry — that
 * is the ambiguous case, and 0 keeps the entry inside every window.
 */
export function elapsedMs(now: Clock, entry: TimedEntry): number {
  if (entry.boot_id !== null && entry.monotonic_ms !== null && entry.boot_id === now.bootId) {
    // Same boot: monotonic is authoritative and immune to wall-clock edits.
    return Math.max(0, now.monotonicMs - entry.monotonic_ms);
  }
  // Cross-boot (or server-seeded): best truth available is skew-corrected wall time.
  const correctedNow = now.wallMs + now.skewMs;
  return Math.max(0, correctedNow - entry.wall_ms);
}

/** Skew anchor from a server_time value (ISO string) against the device wall clock. */
export function computeSkewMs(deviceWallMs: number, serverTimeIso: string): number {
  const server = Date.parse(serverTimeIso);
  if (Number.isNaN(server)) return 0;
  return server - deviceWallMs;
}
