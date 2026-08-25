import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { EventBatchSchema, type EventBatch, type IngestAck } from "@lift/protocol";

/**
 * Durable ingest without a database. One JSON file per accepted batch -
 * written .tmp-then-rename (atomic on this filesystem) - and FILE EXISTENCE is
 * the dedupe index: a batch_id that already has a file is a retry, absorbed
 * with a fresh ack and no reprocessing. runs/ is generated-artifact territory,
 * consistent with how the rest of the repo persists run output.
 */

const DELIVERY_DIR = resolve(process.cwd(), "../../runs/delivery");
const EVENTS_DIR = resolve(DELIVERY_DIR, "events");
const SUPPRESSIONS_PATH = resolve(DELIVERY_DIR, "suppressions.json");

export interface SuppressionAggregate {
  [opportunityKey: string]: {
    decisions: number;
    delivered: number;
    suppressed: Record<string, number>;
    last_batch_id: string;
    updated_at: string;
  };
}

function batchPath(batchId: string): string {
  // batch_id is device-generated; keep it filesystem-safe.
  return resolve(EVENTS_DIR, `${batchId.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`);
}

export function readSuppressions(): SuppressionAggregate {
  try {
    return JSON.parse(readFileSync(SUPPRESSIONS_PATH, "utf8")) as SuppressionAggregate;
  } catch {
    return {};
  }
}

function writeAtomic(path: string, body: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, body);
  renameSync(tmp, path);
}

/** Fold a batch's decision events into the cumulative per-opportunity aggregate. */
function aggregate(batch: EventBatch): SuppressionAggregate {
  const agg = readSuppressions();
  const now = new Date().toISOString();
  for (const e of batch.events) {
    if (e.type !== "decision") continue;
    const key = e.decision.opportunity_key;
    if (!key) continue;
    const row = (agg[key] ??= { decisions: 0, delivered: 0, suppressed: {}, last_batch_id: batch.batch_id, updated_at: now });
    row.decisions += 1;
    if (e.decision.outcome === "delivered") row.delivered += 1;
    if (e.decision.outcome === "suppressed") {
      // "frequency_cap:weekly_2:2/2" -> bucket by rule ("frequency_cap:weekly_2").
      const rule = e.decision.reason.split(":").slice(0, 2).join(":");
      row.suppressed[rule] = (row.suppressed[rule] ?? 0) + 1;
    }
    row.last_batch_id = batch.batch_id;
    row.updated_at = now;
  }
  writeAtomic(SUPPRESSIONS_PATH, JSON.stringify(agg, null, 2));
  return agg;
}

export interface IngestOutcome {
  ack: IngestAck;
  /** Present only when this batch was newly processed (not a duplicate). */
  aggregate: SuppressionAggregate | null;
}

/**
 * One sentence a marketer (and the next explorer run) can read. This exact
 * string lands in Memory under "<key>#delivery" and is rendered into the
 * explorer prompt - a fact only the device could have known.
 */
export function renderDeliveryClaim(key: string, row: SuppressionAggregate[string]): string {
  const suppressed = Object.entries(row.suppressed)
    .map(([rule, n]) => `${n} under ${rule}`)
    .join(", ");
  const parts = [`Delivery observed for ${key}: ${row.delivered}/${row.decisions} in-app decisions delivered`];
  if (suppressed) parts.push(`suppressed ${suppressed}`);
  return `${parts.join("; ")}.`;
}

export function ingestBatch(raw: unknown): IngestOutcome {
  const batch = EventBatchSchema.parse(raw);
  const path = batchPath(batch.batch_id);
  const serverTime = new Date().toISOString();

  if (existsSync(path)) {
    // Retry of an already-ingested batch: same id, absorb silently.
    return {
      ack: { ok: true, batch_id: batch.batch_id, received: batch.events.length, duplicate: true, server_time: serverTime },
      aggregate: null,
    };
  }

  writeAtomic(path, JSON.stringify(batch, null, 2));
  const agg = aggregate(batch);
  return {
    ack: { ok: true, batch_id: batch.batch_id, received: batch.events.length, duplicate: false, server_time: serverTime },
    aggregate: agg,
  };
}
