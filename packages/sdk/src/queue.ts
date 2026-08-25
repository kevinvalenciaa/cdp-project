import type { ClientEvent, EventBatch } from "@lift/protocol";
import type { StorageAdapter } from "./storage.js";

/**
 * Durable event queue. The rules, in order of importance:
 *   1. persist BEFORE flush - an event accepted by add() survives process death
 *   2. ack-then-delete - events leave the queue only after the server confirms
 *   3. bounded - past maxEvents the OLDEST drop, and the loss is REPORTED via
 *      dropped_since_last_batch instead of hidden
 * A sealed batch keeps its batch_id until acked, so a retry after a network
 * failure re-sends the SAME id and the server's dedupe absorbs it.
 */

interface QueueState {
  events: ClientEvent[];
  /** Monotonically increasing batch counter - batch ids survive restarts. */
  batchSeq: number;
  /** Events dropped to the bound since the last successful flush. */
  dropped: number;
  /** An in-flight (sealed, unacked) batch survives process death too. */
  sealed: { batch_id: string; events: ClientEvent[] } | null;
}

const EMPTY: QueueState = { events: [], batchSeq: 0, dropped: 0, sealed: null };

export class EventQueue {
  private state: QueueState = { ...EMPTY, events: [] };

  constructor(
    private readonly storage: StorageAdapter,
    private readonly maxEvents = 500,
    private readonly key = "lift.queue.v1",
  ) {}

  static async load(storage: StorageAdapter, maxEvents = 500, key = "lift.queue.v1"): Promise<EventQueue> {
    const q = new EventQueue(storage, maxEvents, key);
    const raw = await storage.getItem(key);
    if (raw) {
      try {
        q.state = { ...EMPTY, ...(JSON.parse(raw) as QueueState) };
      } catch {
        q.state = { ...EMPTY, events: [] };
      }
    }
    return q;
  }

  private async persist(): Promise<void> {
    await this.storage.setItem(this.key, JSON.stringify(this.state));
  }

  /** Accept an event. Persisted before this resolves. */
  async add(event: ClientEvent): Promise<void> {
    this.state.events.push(event);
    if (this.state.events.length > this.maxEvents) {
      const overflow = this.state.events.length - this.maxEvents;
      this.state.events = this.state.events.slice(overflow);
      this.state.dropped += overflow;
    }
    await this.persist();
  }

  pendingCount(): number {
    return this.state.events.length + (this.state.sealed?.events.length ?? 0);
  }

  droppedSinceLastFlush(): number {
    return this.state.dropped;
  }

  /**
   * Seal the current events into a batch for sending. If an unacked batch is
   * already in flight, THAT batch is returned again (same id - idempotent
   * retry) rather than sealing a second one.
   */
  async seal(deviceId: string, userId: string | null, sdkVersion: string, wallIso: string): Promise<EventBatch | null> {
    if (!this.state.sealed) {
      if (this.state.events.length === 0) return null;
      this.state.batchSeq += 1;
      this.state.sealed = { batch_id: `${deviceId}-${this.state.batchSeq}`, events: this.state.events };
      this.state.events = [];
      await this.persist();
    }
    return {
      batch_id: this.state.sealed.batch_id,
      device_id: deviceId,
      user_id: userId,
      sdk_version: sdkVersion,
      sent_at_wall: wallIso,
      dropped_since_last_batch: this.state.dropped,
      events: this.state.sealed.events,
    };
  }

  /** Server acked the batch: only now do its events (and the loss counter) clear. */
  async ack(batchId: string): Promise<void> {
    if (this.state.sealed?.batch_id === batchId) {
      this.state.sealed = null;
      this.state.dropped = 0;
      await this.persist();
    }
  }
}
