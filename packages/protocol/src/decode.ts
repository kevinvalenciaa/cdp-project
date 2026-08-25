import { z } from "zod";
import { CampaignSchema, DecisionBundleSchema, type Campaign, type DecisionBundle } from "./bundle.js";

/**
 * Forward-compatible bundle decoding.
 *
 * The one rule: a client you cannot force-update must NEVER crash on a bundle
 * from a newer server, and must NEVER silently evaluate a campaign it does not
 * understand. An unrecognised operator, template, or campaign shape skips THAT
 * campaign - with the reason recorded - and every other campaign keeps working.
 *
 * decode() throws DecodeError only when the envelope itself is unreadable, in
 * which case the transport keeps the last good bundle.
 */

export class DecodeError extends Error {}

export interface SkippedCampaign {
  campaign_id: string;
  reason: string;
}

export interface DecodedBundle {
  bundle: DecisionBundle;
  /** Campaigns this client version could not understand - surfaced, not swallowed. */
  skipped: SkippedCampaign[];
}

/** Envelope with campaigns left raw so one bad campaign cannot fail the whole bundle. */
const EnvelopeSchema = DecisionBundleSchema.omit({ campaigns: true }).extend({
  campaigns: z.array(z.unknown()),
});

function firstIssue(err: z.ZodError): string {
  const i = err.issues[0];
  if (!i) return "invalid";
  const path = i.path.length ? i.path.join(".") : "(root)";
  return `${path}: ${i.message}`;
}

export function decodeBundle(json: unknown): DecodedBundle {
  const env = EnvelopeSchema.safeParse(json);
  if (!env.success) throw new DecodeError(`unreadable bundle envelope - ${firstIssue(env.error)}`);

  const kept: Campaign[] = [];
  const skipped: SkippedCampaign[] = [];
  for (const raw of env.data.campaigns) {
    const c = CampaignSchema.safeParse(raw);
    if (c.success) {
      kept.push(c.data);
    } else {
      const id =
        typeof raw === "object" && raw !== null && "campaign_id" in raw
          ? String((raw as { campaign_id: unknown }).campaign_id)
          : "(unknown)";
      skipped.push({ campaign_id: id, reason: firstIssue(c.error) });
    }
  }

  return { bundle: { ...env.data, campaigns: kept }, skipped };
}
