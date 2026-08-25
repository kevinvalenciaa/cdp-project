import { z } from "zod";

/**
 * Events collected on-device, batched, and shipped UP to the backend.
 *
 * Every event carries both clock stamps (wall + monotonic-since-boot + boot id)
 * so the server can order events from a device whose wall clock cannot be
 * trusted. See @lift/sdk clock.ts for why.
 */

const EventBase = {
  event_id: z.string().min(1),
  /** Device wall-clock ISO timestamp - display only, never used for windows. */
  ts_wall: z.string(),
  /** Milliseconds since device boot at capture time. */
  ts_monotonic_ms: z.number(),
  /** Random id regenerated each boot; pairs with ts_monotonic_ms. */
  boot_id: z.string().min(1),
  props: z.record(z.string(), z.unknown()).default({}),
};

export const ScreenEventSchema = z.object({ ...EventBase, type: z.literal("screen"), name: z.string().min(1) });
export const TrackEventSchema = z.object({ ...EventBase, type: z.literal("track"), name: z.string().min(1) });
export const IdentifyEventSchema = z.object({ ...EventBase, type: z.literal("identify"), user_id: z.string().min(1) });

/** The delivery receipt - what the device DECIDED, including every suppression and why. */
export const DecisionEventSchema = z.object({
  ...EventBase,
  type: z.literal("decision"),
  decision: z.object({
    bundle_id: z.string(),
    surface: z.string(),
    campaign_id: z.string().nullable(),
    opportunity_key: z.string().nullable(),
    arm_id: z.string().nullable(),
    outcome: z.enum(["delivered", "suppressed", "no_campaign", "holdout"]),
    /** Machine-readable reason trail, e.g. "frequency_cap:weekly_2:2/2". */
    reason: z.string(),
  }),
});

export const ClientEventSchema = z.discriminatedUnion("type", [
  ScreenEventSchema,
  TrackEventSchema,
  IdentifyEventSchema,
  DecisionEventSchema,
]);
export type ClientEvent = z.infer<typeof ClientEventSchema>;

export const EventBatchSchema = z.object({
  batch_id: z.string().min(1),
  device_id: z.string().min(1),
  user_id: z.string().nullable().default(null),
  sdk_version: z.string(),
  /** Wall time when the batch was sealed for sending. */
  sent_at_wall: z.string(),
  /**
   * Events the SDK had to drop (bounded buffer overflow) since the last
   * successful flush. The SDK reports its own data loss instead of hiding it.
   */
  dropped_since_last_batch: z.number().int().min(0).default(0),
  events: z.array(ClientEventSchema),
});
export type EventBatch = z.infer<typeof EventBatchSchema>;

export const IngestAckSchema = z.object({
  ok: z.literal(true),
  batch_id: z.string(),
  received: z.number().int().min(0),
  /** True when this batch_id was already ingested - the retry was safely absorbed. */
  duplicate: z.boolean(),
  /** Server wall clock - the SDK's skew anchor, present on every response. */
  server_time: z.string(),
});
export type IngestAck = z.infer<typeof IngestAckSchema>;
