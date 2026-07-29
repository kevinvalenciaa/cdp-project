import type Anthropic from "@anthropic-ai/sdk";
import { config } from "../shared/env.js";
import type { CostLedger } from "../shared/cost.js";
import type { Opportunity } from "./types.js";

/**
 * Verifier check #2 — the LLM groundedness cross-check (check #1 is the statistical gate).
 * Asks: do the numbers asserted in the opportunity's claim actually appear in its stored
 * evidence? This is deliberately DEMOTE-ONLY: it can pull an accepted opportunity out of
 * the ranked list, never promote a rejected one — the statistical verdict stays the source
 * of truth, and an ungrounded narrative is disqualifying even when the stats pass.
 * Fail-closed like guardrails/guard.ts: if the verdict cannot be parsed after one retry,
 * the opportunity is demoted rather than waved through.
 */
export interface GroundedResult {
  verdict: "pass" | "demote" | "n/a";
  reason: string;
}

export async function checkGroundedness(client: Anthropic, ledger: CostLedger, opp: Opportunity): Promise<GroundedResult> {
  const claim =
    `${opp.reason} ` +
    `(asserted: uplift=${opp.upliftPp?.toFixed(2)}pp, p=${opp.pValue?.toFixed(4)}, reach=${opp.reach}, value=$${opp.value.toFixed(2)})`;
  // Derive the rates deterministically and hand them to the judge: its job is checking
  // that the CLAIM TEXT agrees with the evidence numbers (groundedness), not re-doing
  // division — small models flub arithmetic, and a false demote is a real cost.
  const ev = opp.evidence as { conv_t?: number; n_t?: number; conv_c?: number; n_c?: number };
  const derived =
    ev.n_t && ev.n_c
      ? `Derived from the evidence (computed deterministically): treatment rate ${(((ev.conv_t ?? 0) / ev.n_t) * 100).toFixed(2)}%, ` +
        `control rate ${(((ev.conv_c ?? 0) / ev.n_c) * 100).toFixed(2)}%, ` +
        `difference ${((((ev.conv_t ?? 0) / ev.n_t - (ev.conv_c ?? 0) / ev.n_c) * 100)).toFixed(2)}pp, total reach ${ev.n_t + ev.n_c}.\n`
      : "";
  const prompt =
    `You are a groundedness checker. Claim about campaign "${opp.title}":\n${claim}\n` +
    `Stored evidence (raw counts from the warehouse):\n${JSON.stringify(opp.evidence)}\n` +
    derived +
    `Does the claim's text agree with the evidence and derived numbers (no contradictions, no invented figures)? ` +
    `Small rounding differences are fine. Reply with ONLY compact JSON: {"grounded": true|false, "reason": "<=18 words"}.`;

  const ask = async (): Promise<GroundedResult | null> => {
    const resp = await client.messages.create({
      model: config.models.fanout, // cross-checks are cheap-tier work (Haiku)
      max_tokens: 80,
      temperature: 0, // a gate verdict should not be a coin flip
      messages: [{ role: "user", content: prompt }],
    });
    ledger.add(resp.model, resp.usage.input_tokens, resp.usage.output_tokens);
    const text = resp.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    try {
      const m = text.match(/\{[\s\S]*\}/);
      const j = JSON.parse(m ? m[0] : text);
      return { verdict: j.grounded === true ? "pass" : "demote", reason: String(j.reason ?? "") };
    } catch {
      return null;
    }
  };

  const first = await ask();
  if (first) return first;
  const second = await ask(); // one retry before failing closed
  return second ?? { verdict: "demote", reason: "could not parse groundedness verdict; demoting to be safe" };
}
