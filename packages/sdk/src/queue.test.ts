import { describe, expect, it } from "vitest";
import type { ClientEvent } from "@lift/protocol";
import { EventQueue } from "./queue.js";
import { MemoryStorage } from "./storage.js";

const ev = (i: number): ClientEvent => ({
  type: "track",
  name: `event_${i}`,
  event_id: `e-${i}`,
  ts_wall: new Date(1_750_000_000_000 + i).toISOString(),
  ts_monotonic_ms: 1000 + i,
  boot_id: "b1",
  props: {},
});

describe("EventQueue durability", () => {
  it("persists BEFORE flush: an added event survives process death (reload from storage)", async () => {
    const storage = new MemoryStorage();
    const q1 = await EventQueue.load(storage);
    await q1.add(ev(1));
    await q1.add(ev(2));
    // "Process death": drop the instance, reload from the same storage.
    const q2 = await EventQueue.load(storage);
    expect(q2.pendingCount()).toBe(2);
  });

  it("ack-then-delete: events leave only after the server confirms, and a sealed batch keeps its id for idempotent retry", async () => {
    const storage = new MemoryStorage();
    const q = await EventQueue.load(storage);
    await q.add(ev(1));
    const b1 = await q.seal("d1", null, "0.1.0", "2025-06-15T00:00:00Z");
    expect(b1).not.toBeNull();
    // Network failed; new events arrive; seal again -> SAME batch id (retry, not a fork).
    await q.add(ev(2));
    const b2 = await q.seal("d1", null, "0.1.0", "2025-06-15T00:01:00Z");
    expect(b2!.batch_id).toBe(b1!.batch_id);
    expect(q.pendingCount()).toBe(2); // sealed 1 + queued 1 - nothing lost
    // Even across a restart, the in-flight batch survives.
    const q2 = await EventQueue.load(storage);
    expect(q2.pendingCount()).toBe(2);
    await q2.ack(b1!.batch_id);
    expect(q2.pendingCount()).toBe(1); // only the acked batch cleared
  });

  it("bounded buffer drops OLDEST and reports its own loss via dropped_since_last_batch", async () => {
    const storage = new MemoryStorage();
    const q = await EventQueue.load(storage, 3);
    for (let i = 1; i <= 5; i++) await q.add(ev(i));
    expect(q.pendingCount()).toBe(3);
    expect(q.droppedSinceLastFlush()).toBe(2);
    const batch = await q.seal("d1", null, "0.1.0", "2025-06-15T00:00:00Z");
    expect(batch!.dropped_since_last_batch).toBe(2);
    // Newest survived, oldest dropped.
    expect(batch!.events.map((e) => e.event_id)).toEqual(["e-3", "e-4", "e-5"]);
    await q.ack(batch!.batch_id);
    expect(q.droppedSinceLastFlush()).toBe(0); // loss counter clears on ack
  });

  it("batch ids increase across restarts (no reuse after ack)", async () => {
    const storage = new MemoryStorage();
    const q1 = await EventQueue.load(storage);
    await q1.add(ev(1));
    const b1 = await q1.seal("d1", null, "0.1.0", "t");
    await q1.ack(b1!.batch_id);
    const q2 = await EventQueue.load(storage);
    await q2.add(ev(2));
    const b2 = await q2.seal("d1", null, "0.1.0", "t");
    expect(b2!.batch_id).not.toBe(b1!.batch_id);
  });
});
