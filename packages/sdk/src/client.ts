import type { ClientEvent, DecisionBundle, SkippedCampaign } from "@lift/protocol";
import { computeSkewMs, type Clock, type ClockSource } from "./clock.js";
import { evaluateBundle, type Decision, type EvalCtx } from "./eligibility.js";
import { FrequencyLedger } from "./frequency.js";
import { matchPredicate } from "./predicate.js";
import { EventQueue } from "./queue.js";
import { fnv1a } from "./rng.js";
import { MemoryStorage, type StorageAdapter } from "./storage.js";
import { fetchBundle, postBatch } from "./transport.js";
import type { Attrs } from "./predicate.js";

export const SDK_VERSION = "0.1.0";

/**
 * The public facade. Init is deliberately one call with sane defaults — the
 * host supplies its API base and storage, and everything else has a working
 * default that can be overridden.
 */
export interface LiftConfig {
  /** e.g. http://192.168.1.20:3000 — the dashboard serving /api/bundle + /api/ingest. */
  apiBase: string;
  /** Host storage (AsyncStorage in RN). Defaults to in-memory (non-durable!). */
  storage?: StorageAdapter;
  /** Stable device id; generated and persisted when omitted. */
  deviceId?: string;
  /** Bundle poll cadence. */
  pollIntervalMs?: number;
  /** Flush cadence for the event queue. */
  flushIntervalMs?: number;
  /** Injectable clock for tests; defaults to Date.now + performance.now. */
  clockSource?: ClockSource;
  /** User attributes used for eligibility until identify() provides more. */
  attrs?: Attrs;
}

export interface DebugState {
  bundleId: string | null;
  skippedCampaigns: SkippedCampaign[];
  skewMs: number;
  queueDepth: number;
  droppedSinceLastFlush: number;
  ledger: readonly import("./frequency.js").LedgerEntry[];
  lastDecision: Decision | null;
  online: boolean;
  lastError: string | null;
}

type Listener = () => void;

const nowIso = (clock: Clock): string => new Date(clock.wallMs).toISOString();

export class LiftCompass {
  private bundle: DecisionBundle | null = null;
  private skipped: SkippedCampaign[] = [];
  private etag: string | null = null;
  private skewMs = 0;
  private ledger!: FrequencyLedger;
  private queue!: EventQueue;
  private storage: StorageAdapter;
  private clockSource: ClockSource;
  private deviceId = "device-unset";
  private userId: string | null = null;
  private attrs: Attrs;
  private sessionId = "session-unset";
  private lastDecision: Decision | null = null;
  private lastError: string | null = null;
  private online = true;
  private listeners = new Set<Listener>();
  private timers: ReturnType<typeof setTimeout>[] = [];
  private flushBackoffMs = 0;
  private bootId = "boot-unset";
  private started = false;

  private constructor(private readonly cfg: LiftConfig) {
    this.storage = cfg.storage ?? new MemoryStorage();
    this.attrs = cfg.attrs ?? {};
    const monotonicStart = Date.now();
    this.clockSource =
      cfg.clockSource ??
      (() => ({
        wallMs: Date.now(),
        // performance.now() where available (RN/Hermes has it); otherwise ms
        // since SDK init — still monotonic within the process, which is the
        // guarantee the ledger needs.
        monotonicMs:
          typeof globalThis.performance?.now === "function" ? globalThis.performance.now() : Date.now() - monotonicStart,
        bootId: this.bootId,
        skewMs: this.skewMs,
      }));
  }

  /** One call, sane defaults. This is the ~15 lines the host writes. */
  static async init(cfg: LiftConfig): Promise<LiftCompass> {
    const sdk = new LiftCompass(cfg);
    sdk.ledger = await FrequencyLedger.load(sdk.storage);
    sdk.queue = await EventQueue.load(sdk.storage);
    sdk.deviceId = cfg.deviceId ?? (await sdk.persistedId("lift.device_id", "d"));
    // bootId approximates a boot with a process launch: monotonicMs is ms since
    // this process started, and the pair travels together in every ledger entry.
    sdk.bootId = `b-${fnv1a(`${sdk.deviceId}|${Date.now()}`)}`;
    sdk.sessionId = `s-${fnv1a(`${sdk.bootId}|session`)}`;
    return sdk;
  }

  private async persistedId(key: string, prefix: string): Promise<string> {
    const existing = await this.storage.getItem(key);
    if (existing) return existing;
    const id = `${prefix}-${fnv1a(`${key}|${Date.now()}|${Math.floor(Math.random() * 1e9)}`)}`;
    await this.storage.setItem(key, id);
    return id;
  }

  /** Begin bundle polling + queue flushing. Idempotent. */
  start(): void {
    if (this.started) return;
    this.started = true;
    void this.refreshBundle();
    const poll = () => {
      this.timers.push(
        setTimeout(() => {
          void this.refreshBundle().finally(poll);
        }, this.cfg.pollIntervalMs ?? 15_000),
      );
    };
    poll();
    const flush = () => {
      const base = this.cfg.flushIntervalMs ?? 5_000;
      this.timers.push(
        setTimeout(() => {
          void this.flush().finally(flush);
        }, base + this.flushBackoffMs),
      );
    };
    flush();
  }

  stop(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    this.started = false;
  }

  // ---- events ----------------------------------------------------------

  async screen(name: string, props: Record<string, unknown> = {}): Promise<void> {
    await this.enqueue({ type: "screen", name, props });
  }

  async track(name: string, props: Record<string, unknown> = {}): Promise<void> {
    await this.enqueue({ type: "track", name, props });
  }

  async identify(userId: string, attrs: Attrs = {}): Promise<void> {
    this.userId = userId;
    this.attrs = { ...this.attrs, ...attrs };
    await this.enqueue({ type: "identify", user_id: userId, props: {} });
  }

  private async enqueue(
    partial:
      | { type: "screen" | "track"; name: string; props: Record<string, unknown> }
      | { type: "identify"; user_id: string; props: Record<string, unknown> }
      | { type: "decision"; decision: Extract<ClientEvent, { type: "decision" }>["decision"]; props: Record<string, unknown> },
  ): Promise<void> {
    const clock = this.clockSource();
    const event = {
      ...partial,
      event_id: `e-${this.deviceId}-${fnv1a(`${clock.monotonicMs}|${this.queue.pendingCount()}|${JSON.stringify(partial)}`)}`,
      ts_wall: nowIso(clock),
      ts_monotonic_ms: clock.monotonicMs,
      boot_id: clock.bootId,
    } as ClientEvent;
    await this.queue.add(event);
    this.emit();
  }

  // ---- decisions -------------------------------------------------------

  /**
   * Decide what (if anything) renders on a surface. Distinguishes "no bundle
   * loaded yet" from "bundle says nothing" — different renders for the host.
   */
  async decide(surface: string): Promise<Decision | { outcome: "no_bundle"; surface: string; reason: string }> {
    if (!this.bundle) {
      return { outcome: "no_bundle", surface, reason: "bundle not loaded yet" };
    }
    const clock = this.clockSource();
    const ctx: EvalCtx = {
      userId: this.userId,
      deviceId: this.deviceId,
      sessionId: this.sessionId,
      surface,
      attrs: this.attrs,
    };
    const entries = this.ledger.withRecentSends(this.bundle.recent_sends);
    const decision = evaluateBundle(this.bundle, ctx, entries, clock);
    this.lastDecision = decision;

    if (decision.outcome === "delivered") {
      await this.ledger.record({
        campaign_id: decision.campaign_id!,
        channel: "in_app",
        wall_ms: clock.wallMs,
        monotonic_ms: clock.monotonicMs,
        boot_id: clock.bootId,
        session_id: this.sessionId,
      });
    }
    await this.enqueue({
      type: "decision",
      decision: {
        bundle_id: decision.bundle_id,
        surface: decision.surface,
        campaign_id: decision.campaign_id,
        opportunity_key: decision.opportunity_key,
        arm_id: decision.arm_id,
        outcome: decision.outcome,
        reason: decision.reason,
      },
      props: {},
    });
    this.emit();
    return decision;
  }

  // ---- network ---------------------------------------------------------

  async refreshBundle(): Promise<void> {
    try {
      const r = await fetchBundle(this.cfg.apiBase, this.etag);
      if (r.serverTime) this.skewMs = computeSkewMs(this.clockSource().wallMs, r.serverTime);
      if (r.status === 200 && r.decoded) {
        this.bundle = r.decoded.bundle;
        this.skipped = r.decoded.skipped;
        this.etag = r.etag;
      }
      this.online = true;
      this.lastError = null;
    } catch (err) {
      this.online = false;
      this.lastError = err instanceof Error ? err.message : String(err);
    }
    this.emit();
  }

  async flush(): Promise<void> {
    const clock = this.clockSource();
    const batch = await this.queue.seal(this.deviceId, this.userId, SDK_VERSION, nowIso(clock));
    if (!batch) return;
    try {
      const r = await postBatch(this.cfg.apiBase, batch);
      await this.queue.ack(r.ack.batch_id);
      if (r.serverTime) this.skewMs = computeSkewMs(this.clockSource().wallMs, r.serverTime);
      this.online = true;
      this.lastError = null;
      this.flushBackoffMs = 0;
    } catch (err) {
      this.online = false;
      this.lastError = err instanceof Error ? err.message : String(err);
      // Jittered exponential backoff, capped at 60s. The sealed batch keeps its
      // id, so the eventual retry is idempotent on the server.
      const next = Math.min(60_000, (this.flushBackoffMs || 1_000) * 2);
      this.flushBackoffMs = next / 2 + Math.floor(Math.random() * (next / 2));
    }
    this.emit();
  }

  // ---- introspection ---------------------------------------------------

  /** Everything the DebugPanel shows. The honest surface. */
  debugState(): DebugState {
    return {
      bundleId: this.bundle?.bundle_id ?? null,
      skippedCampaigns: this.skipped,
      skewMs: this.skewMs,
      queueDepth: this.queue.pendingCount(),
      droppedSinceLastFlush: this.queue.droppedSinceLastFlush(),
      ledger: this.ledger.all(),
      lastDecision: this.lastDecision,
      online: this.online,
      lastError: this.lastError,
    };
  }

  /** Re-run a campaign's predicate against current attrs — DebugPanel explain. */
  explain(campaignId: string): string {
    const c = this.bundle?.campaigns.find((x) => x.campaign_id === campaignId);
    if (!c) return "campaign not in bundle";
    const m = matchPredicate(c.eligibility, this.attrs);
    return m.matched ? "eligible" : m.trail.join("; ");
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }
}
