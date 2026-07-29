import { z } from "zod";
import { DecisionBundleSchema } from "./bundle.js";

/**
 * Golden decision vectors — the contract's spec-as-data.
 *
 * Each vectors/*.json file freezes (bundle, ctx, ledger, clock) -> expected
 * decision. They were authored BEFORE the SDK implementation as the behavioural
 * spec; the SDK's test suite replays them through evaluateBundle(). They are
 * deliberately implementation-independent: any assertion that would depend on
 * RNG internals uses degenerate posteriors instead of a pinned sample.
 */

/** One row of delivery history as the device evaluator sees it. */
export const LedgerEntrySchema = z.object({
  campaign_id: z.string(),
  channel: z.enum(["in_app", "sms", "email", "push"]),
  /** Device wall clock at record time (ms epoch). Display + cross-boot fallback only. */
  wall_ms: z.number(),
  /** Monotonic ms-since-boot at record time; null when unknown (e.g. server-seeded). */
  monotonic_ms: z.number().nullable(),
  /** Boot id the entry was recorded under; null when server-seeded. */
  boot_id: z.string().nullable(),
  /** Session the entry belongs to; null when server-seeded. */
  session_id: z.string().nullable(),
});
export type LedgerEntry = z.infer<typeof LedgerEntrySchema>;

export const ClockSchema = z.object({
  /** Device wall clock, ms epoch. The value an attacker (or DST) can move. */
  wallMs: z.number(),
  /** Monotonic ms since boot. Cannot be set backwards. */
  monotonicMs: z.number(),
  /** Random id regenerated each boot. */
  bootId: z.string(),
  /** serverTime - deviceWall from the last response's server_time anchor. */
  skewMs: z.number(),
});
export type ClockShape = z.infer<typeof ClockSchema>;

export const VectorSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  bundle: DecisionBundleSchema,
  ctx: z.object({
    user_id: z.string(),
    device_id: z.string(),
    session_id: z.string(),
    surface: z.string(),
    attrs: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
    seed: z.number().int(),
  }),
  ledger: z.array(LedgerEntrySchema),
  clock: ClockSchema,
  expected: z.object({
    outcome: z.enum(["delivered", "suppressed", "no_campaign", "holdout"]),
    campaign_id: z.string().nullable(),
    arm_id: z.string().nullable().optional(),
    reason_prefix: z.string(),
  }),
});
export type DecisionVector = z.infer<typeof VectorSchema>;
