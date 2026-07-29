import { createHash } from "node:crypto";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { DecisionBundleSchema, type Arm, type Cap, type DecisionBundle } from "@lift/protocol";
import type { ActivationResult } from "../activation/activate.js";
import { callMcpTool } from "../harness/mcp-client.js";
import { learnPosteriors } from "./posteriors.js";

/**
 * Compile a VERIFIED, guardrail-cleared activation into the decision bundle a
 * device evaluates locally. This is the seam between the two halves of the
 * system: everything upstream (explorer -> investigators -> prioritizer ->
 * verifier -> creative -> guardrails) is agentic; everything downstream of the
 * bundle is deterministic.
 */

/**
 * THE frequency cap — one definition serving both machines. The server-side
 * exclusion (activation/caps.ts) and the device-side caps in every compiled
 * bundle derive from this constant, so the two enforcement points cannot
 * drift apart silently.
 */
export const FREQUENCY_CAP = { id: "weekly_2", windowDays: 7, maxSends: 2 } as const;

export const DELIVERY_CAPS: Cap[] = [
  { id: FREQUENCY_CAP.id, scope: "user", channel: "any", max: FREQUENCY_CAP.maxSends, window: `P${FREQUENCY_CAP.windowDays}D` },
  { id: "session_1", scope: "session", channel: "in_app", max: 1, window: "session" },
];

/**
 * The anchor for all compiled timestamps is the newest send in the warehouse,
 * NOT the wall clock: the seeded calendar is fixed, so anchoring on data keeps
 * the compiled bundle byte-stable for a given seed (stable content hash =
 * stable ETag) and keeps cap windows meaningful against the fixture data.
 */
export async function dataAnchorIso(wh: Client): Promise<string> {
  const r = await callMcpTool(wh, "run_sql", { sql: "SELECT MAX(sent_at) AS anchor FROM campaign_sends" });
  if (r.isError) throw new Error(r.text);
  const anchor = (JSON.parse(r.text).rows as { anchor: string }[])[0]?.anchor;
  if (!anchor) throw new Error("campaign_sends is empty — cannot anchor bundle timestamps");
  return new Date(`${anchor}T00:00:00Z`).toISOString();
}

/** Two creative slots, mirroring the A/B slots campaign_sends already tracks. */
const SLOTS = ["A", "B"] as const;

/**
 * The drafted variants are channel creative (SMS/email) being recompiled for
 * an in-app surface: channel-only placeholders like "[link]" or a trailing
 * "Reply STOP..." have no meaning in-app — the CTA button IS the link. Strip
 * them at compile time; the host never has to clean up copy.
 */
function inAppBody(text: string): string {
  return text
    .replace(/\s*(?:→|->)?\s*\[link\][.!]?\s*$/i, "")
    .replace(/\s*\[link\]\s*/gi, " ")
    .replace(/\s*reply stop to opt out[.!]?\s*$/i, "")
    .trim();
}

function armsFrom(activation: ActivationResult): Arm[] {
  return activation.variants.slice(0, SLOTS.length).map((v, i) => ({
    arm_id: SLOTS[i]!,
    // First slot renders inline, second as a takeover — host decides how.
    template: i === 0 ? ("banner" as const) : ("modal" as const),
    title: activation.opportunity.title,
    body: inAppBody(v.text),
    cta: activation.audience.channel === "email" ? "View collection" : "Shop now",
  }));
}

export async function compileDecisionBundle(wh: Client, runId: string, activation: ActivationResult): Promise<DecisionBundle> {
  const opp = activation.opportunity;
  const anchorIso = await dataAnchorIso(wh);
  const policy = await learnPosteriors(wh, opp.key);

  const body: Omit<DecisionBundle, "bundle_id"> = {
    protocol_version: 1,
    run_id: runId,
    generated_at: anchorIso,
    caps: DELIVERY_CAPS,
    campaigns: [
      {
        campaign_id: `c_${opp.key.toLowerCase()}`,
        opportunity_key: opp.key,
        surface: "home_hero",
        channel: "in_app",
        priority: 10,
        // The SAME predicate the server activates with — audience predicates
        // are canonical, SQL and device evaluation are both compiled from them.
        eligibility: { all: [activation.audience.filter, activation.audience.persuadableFilter] },
        segment_key: "attr:value_tier",
        caps: [],
        arms: armsFrom(activation),
        guardrail_ids: activation.guardrail.details.length
          ? ["premium_no_discount", "seasonality_not_opportunity", "premium_brand_tone"]
          : [],
        provenance: {
          run_id: runId,
          opportunity_key: opp.key,
          fingerprints: opp.provenance?.queries.map((q) => q.fingerprint) ?? [],
        },
      },
    ],
    policy,
    // The activation that produced this bundle just sent on its own channel —
    // the device must know, or in-app piles onto a user sms/email already hit.
    recent_sends:
      activation.sync !== null
        ? [{ channel: activation.audience.channel, campaign_id: `c_${opp.key.toLowerCase()}`, sent_at: anchorIso }]
        : [],
    holdout_fraction: 0,
  };

  const bundle_id = `bnd_${createHash("sha256").update(JSON.stringify(body)).digest("hex").slice(0, 12)}`;
  // Parse before returning: the compiler must never emit a bundle the wire
  // schema would reject — fixture generation validates itself.
  return DecisionBundleSchema.parse({ ...body, bundle_id });
}
