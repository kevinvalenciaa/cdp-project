import { z } from "zod";

/**
 * The decision bundle: rules pushed DOWN from the backend, evaluated LOCALLY on
 * the device. The server compiles it from a verified opportunity; the SDK's
 * evaluateBundle() consumes it with no network and no LLM.
 *
 * Versioning stance (deliberate): one protocol version, additive evolution.
 * Forward compatibility lives in decode.ts — an old client receiving a campaign
 * it cannot understand skips THAT campaign with a recorded reason and keeps the
 * rest working. No semver ceremony until there is a second consumer.
 */

export const PROTOCOL_VERSION = 1;

/** Same operator set as the semantic layer's ALLOWED_OPS (core mcp-warehouse/semantic.ts). */
export const PREDICATE_OPS = ["=", "!=", "<", ">", "<=", ">=", "in"] as const;

export const PredicateLeafSchema = z.object({
  column: z.string().min(1),
  op: z.enum(PREDICATE_OPS),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number()]))]),
});
export type PredicateLeaf = z.infer<typeof PredicateLeafSchema>;

export type Predicate = PredicateLeaf | { all: Predicate[] } | { any: Predicate[] } | { not: Predicate };

export const PredicateSchema: z.ZodType<Predicate> = z.lazy(() =>
  z.union([
    PredicateLeafSchema,
    z.object({ all: z.array(PredicateSchema) }),
    z.object({ any: z.array(PredicateSchema) }),
    z.object({ not: PredicateSchema }),
  ]),
);

/**
 * Frequency cap. `window` is "session" or an ISO-8601 duration (P7D, PT24H, PT4H).
 * `channel: "any"` counts sends across every channel — the cross-channel cap.
 */
export const CapSchema = z.object({
  id: z.string().min(1),
  scope: z.enum(["user", "session"]),
  channel: z.enum(["any", "in_app", "sms", "email", "push"]).default("any"),
  max: z.number().int().positive(),
  window: z.union([z.literal("session"), z.string().regex(/^P(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?)?$/, "ISO-8601 duration subset")]),
});
export type Cap = z.infer<typeof CapSchema>;

/** One renderable message variant. The HOST renders it — the SDK only decides. */
export const ArmSchema = z.object({
  arm_id: z.string().min(1),
  template: z.enum(["banner", "modal"]),
  title: z.string(),
  body: z.string(),
  cta: z.string(),
});
export type Arm = z.infer<typeof ArmSchema>;

/** Beta posterior per arm, learned server-side from campaign_sends. */
export const PolicySnapshotSchema = z.object({
  /** segment key -> arm_id -> Beta(alpha, beta) */
  segments: z.record(
    z.string(),
    z.record(z.string(), z.object({ alpha: z.number().positive(), beta: z.number().positive() })),
  ),
});
export type PolicySnapshot = z.infer<typeof PolicySnapshotSchema>;

/** Where every campaign came from: the agent run that proposed it and the queries that justified it. */
export const ProvenanceSchema = z.object({
  run_id: z.string(),
  opportunity_key: z.string(),
  fingerprints: z.array(z.string()),
});
export type CampaignProvenance = z.infer<typeof ProvenanceSchema>;

export const CampaignSchema = z.object({
  campaign_id: z.string().min(1),
  opportunity_key: z.string().min(1),
  /** Host-defined placement the campaign may render into (e.g. "home_hero"). */
  surface: z.string().min(1),
  channel: z.literal("in_app"),
  /** Higher wins arbitration when several campaigns are eligible for one surface. */
  priority: z.number().int(),
  eligibility: PredicateSchema,
  /** Key into PolicySnapshot.segments for arm selection. */
  segment_key: z.string().min(1),
  caps: z.array(CapSchema).default([]),
  arms: z.array(ArmSchema).min(1),
  /** Guardrail rule ids this campaign's creative cleared at compile time. */
  guardrail_ids: z.array(z.string()).default([]),
  provenance: ProvenanceSchema,
});
export type Campaign = z.infer<typeof CampaignSchema>;

/**
 * Server-known recent sends (sms/email/push already delivered to this audience),
 * seeded into the device ledger so in-app does not pile onto a user a campaign
 * already reached on another channel.
 */
export const RecentSendSchema = z.object({
  channel: z.enum(["sms", "email", "push"]),
  campaign_id: z.string(),
  /** ISO timestamp of the send, server clock. */
  sent_at: z.string(),
});
export type RecentSend = z.infer<typeof RecentSendSchema>;

export const DecisionBundleSchema = z.object({
  protocol_version: z.number().int(),
  /** Content hash of the bundle body — doubles as the ETag. */
  bundle_id: z.string().min(1),
  run_id: z.string(),
  generated_at: z.string(),
  /** Global caps applied to every campaign (per-campaign caps compose on top). */
  caps: z.array(CapSchema).default([]),
  campaigns: z.array(CampaignSchema),
  policy: PolicySnapshotSchema,
  recent_sends: z.array(RecentSendSchema).default([]),
  /** Fraction of users held out from ALL delivery for measurement (0 disables). */
  holdout_fraction: z.number().min(0).max(1).default(0),
});
export type DecisionBundle = z.infer<typeof DecisionBundleSchema>;
