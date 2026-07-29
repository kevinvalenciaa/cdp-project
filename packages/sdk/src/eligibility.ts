import type { Arm, DecisionBundle } from "@lift/protocol";
import { checkCap, type LedgerEntry } from "./frequency.js";
import { matchPredicate, type Attrs } from "./predicate.js";
import { selectArm } from "./policy.js";
import { Rng, fnv1a } from "./rng.js";
import type { Clock } from "./clock.js";

/**
 * The decision core: pure, synchronous, no I/O, no LLM, no network.
 * Everything it needs arrives as a value; everything it decides leaves as a
 * value with a reason. The golden vectors in @lift/protocol/vectors replay
 * straight through this function.
 */

export interface EvalCtx {
  userId: string | null;
  deviceId: string;
  sessionId: string;
  surface: string;
  attrs: Attrs;
  /** Seed for arm selection; defaults to a stable hash of device+bundle. */
  seed?: number;
}

export interface Decision {
  outcome: "delivered" | "suppressed" | "no_campaign" | "holdout";
  surface: string;
  bundle_id: string;
  campaign_id: string | null;
  opportunity_key: string | null;
  arm_id: string | null;
  /** The full arm for the host to render; the SDK never renders anything. */
  arm: Arm | null;
  reason: string;
  /** Why each candidate was passed over — the DebugPanel's raw material. */
  trail: string[];
}

const none = (bundle: DecisionBundle, surface: string, outcome: Decision["outcome"], reason: string, trail: string[]): Decision => ({
  outcome,
  surface,
  bundle_id: bundle.bundle_id,
  campaign_id: null,
  opportunity_key: null,
  arm_id: null,
  arm: null,
  reason,
  trail,
});

export function evaluateBundle(bundle: DecisionBundle, ctx: EvalCtx, ledger: readonly LedgerEntry[], clock: Clock): Decision {
  const trail: string[] = [];

  // 1. Measurement holdout — before anything renders, deterministically by user.
  if (bundle.holdout_fraction > 0) {
    const basis = ctx.userId ?? ctx.deviceId;
    const bucket = fnv1a(`${basis}|${bundle.run_id}`) % 10_000;
    if (bucket < bundle.holdout_fraction * 10_000) {
      return none(bundle, ctx.surface, "holdout", "holdout", [`bucket ${bucket} < ${bundle.holdout_fraction * 10_000}`]);
    }
  }

  // 2. Candidates for this surface, priority desc, campaign_id asc for stability.
  const candidates = bundle.campaigns
    .filter((c) => c.surface === ctx.surface)
    .sort((a, b) => b.priority - a.priority || a.campaign_id.localeCompare(b.campaign_id));
  if (candidates.length === 0) {
    return none(bundle, ctx.surface, "no_campaign", "no_campaign_for_surface", trail);
  }

  // 3. Walk candidates: predicate, then caps. First fully-clear campaign wins.
  // The highest-priority campaign blocked ONLY by a cap becomes the suppression
  // receipt if nothing below it clears — "which message, or why not".
  let suppressed: { campaignId: string; opportunityKey: string; reason: string } | null = null;

  for (const c of candidates) {
    const m = matchPredicate(c.eligibility, ctx.attrs);
    if (!m.matched) {
      trail.push(`${c.campaign_id}: ineligible — ${m.trail.join("; ")}`);
      continue;
    }

    const capFailure = [...bundle.caps.map((cap) => checkCap(cap, ledger, clock, ctx.sessionId)), ...c.caps.map((cap) => checkCap(cap, ledger, clock, ctx.sessionId, c.campaign_id))].find((r) => !r.ok);
    if (capFailure) {
      trail.push(`${c.campaign_id}: capped — ${capFailure.reason}`);
      if (!suppressed) suppressed = { campaignId: c.campaign_id, opportunityKey: c.opportunity_key, reason: capFailure.reason };
      continue;
    }

    // 4. Arm selection over the shipped posteriors (server learns; device selects).
    // "attr:<name>" resolves the segment per user — e.g. "attr:value_tier"
    // keys the posteriors by THIS user's tier, which is what makes the
    // selection personalisation rather than a global best.
    const segmentKey = c.segment_key.startsWith("attr:")
      ? String(ctx.attrs[c.segment_key.slice(5)] ?? "")
      : c.segment_key;
    const seed = ctx.seed ?? fnv1a(`${ctx.deviceId}|${bundle.bundle_id}`);
    const arm = selectArm(bundle.policy, segmentKey, c.arms, new Rng(seed));
    return {
      outcome: "delivered",
      surface: ctx.surface,
      bundle_id: bundle.bundle_id,
      campaign_id: c.campaign_id,
      opportunity_key: c.opportunity_key,
      arm_id: arm.arm_id,
      arm,
      reason: "ok",
      trail,
    };
  }

  if (suppressed) {
    return {
      outcome: "suppressed",
      surface: ctx.surface,
      bundle_id: bundle.bundle_id,
      campaign_id: suppressed.campaignId,
      opportunity_key: suppressed.opportunityKey,
      arm_id: null,
      arm: null,
      reason: suppressed.reason,
      trail,
    };
  }
  return none(bundle, ctx.surface, "no_campaign", "no_eligible_campaign", trail);
}
