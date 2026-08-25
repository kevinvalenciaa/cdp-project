import type { Cap, RecentSend } from "@lift/protocol";
import { elapsedMs, parseWindowMs, type Clock } from "./clock.js";
import type { StorageAdapter } from "./storage.js";

/**
 * The frequency ledger - the device half of the cap the server enforces with a
 * GROUP BY over campaign_sends. Same rule, different machine: here it is a
 * bounded per-user history with monotonic-clock windows, because the device
 * has no database and an untrusted wall clock.
 */

export interface LedgerEntry {
  campaign_id: string;
  channel: "in_app" | "sms" | "email" | "push";
  wall_ms: number;
  monotonic_ms: number | null;
  boot_id: string | null;
  session_id: string | null;
}

const MAX_ENTRIES = 200;

export class FrequencyLedger {
  private entries: LedgerEntry[] = [];

  constructor(
    private readonly storage: StorageAdapter,
    private readonly key = "lift.ledger.v1",
  ) {}

  static async load(storage: StorageAdapter, key = "lift.ledger.v1"): Promise<FrequencyLedger> {
    const l = new FrequencyLedger(storage, key);
    const raw = await storage.getItem(key);
    if (raw) {
      try {
        l.entries = JSON.parse(raw) as LedgerEntry[];
      } catch {
        l.entries = []; // corrupt state never takes the SDK down
      }
    }
    return l;
  }

  all(): readonly LedgerEntry[] {
    return this.entries;
  }

  /** Record a delivery. Bounded: oldest entries roll off past MAX_ENTRIES. */
  async record(entry: LedgerEntry): Promise<void> {
    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) this.entries = this.entries.slice(-MAX_ENTRIES);
    await this.storage.setItem(this.key, JSON.stringify(this.entries));
  }

  /**
   * Merge server-known cross-channel sends (from the bundle) into the local
   * view. Server timestamps are trusted wall time; monotonic/boot are null so
   * the window math takes the cross-boot path. Dedupes on (channel, campaign,
   * sent_at) so re-fetching a bundle never double-counts.
   */
  withRecentSends(sends: RecentSend[]): LedgerEntry[] {
    const seen = new Set(this.entries.map((e) => `${e.channel}|${e.campaign_id}|${e.wall_ms}`));
    const merged = [...this.entries];
    for (const s of sends) {
      const wall = Date.parse(s.sent_at);
      if (Number.isNaN(wall)) continue;
      const k = `${s.channel}|${s.campaign_id}|${wall}`;
      if (seen.has(k)) continue;
      seen.add(k);
      merged.push({ campaign_id: s.campaign_id, channel: s.channel, wall_ms: wall, monotonic_ms: null, boot_id: null, session_id: null });
    }
    return merged;
  }
}

export interface CapCheck {
  ok: boolean;
  /** Machine-readable, e.g. "frequency_cap:weekly_2:2/2". */
  reason: string;
}

/**
 * Pure cap check over an entry list - evaluateBundle() calls this, so it takes
 * the entries as a value rather than reading the ledger object.
 * `campaignId` scopes campaign-level caps; global caps pass undefined.
 */
export function checkCap(
  cap: Cap,
  entries: readonly LedgerEntry[],
  clock: Clock,
  sessionId: string,
  campaignId?: string,
): CapCheck {
  const window = parseWindowMs(cap.window);
  let count = 0;
  for (const e of entries) {
    if (campaignId !== undefined && e.campaign_id !== campaignId) continue;
    if (cap.channel !== "any" && e.channel !== cap.channel) continue;
    if (cap.scope === "session" || window === "session") {
      if (e.session_id === sessionId) count++;
      continue;
    }
    if (elapsedMs(clock, e) <= window) count++;
  }
  if (count >= cap.max) {
    return { ok: false, reason: `frequency_cap:${cap.id}:${count}/${cap.max}` };
  }
  return { ok: true, reason: `frequency_cap:${cap.id}:${count}/${cap.max}` };
}
