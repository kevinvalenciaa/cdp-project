import type Anthropic from "@anthropic-ai/sdk";
import { config } from "../shared/env.js";
import type { CostLedger } from "../shared/cost.js";
import type { CampaignRow } from "./engine.js";
import type { Hypothesis } from "./types.js";

/**
 * The Explorer stage - breadth over depth, on the cheap tier (Haiku): given the goal, the
 * campaign catalog, and prior verified insights, propose typed hypotheses about what the
 * marketing team should start, stop, or change.
 *
 * THE DETERMINISM SEAM (the one invariant everything downstream relies on): the Explorer
 * can ANNOTATE or OVERFLOW, never add or remove probes. Every verifiable probe is always
 * investigated regardless of what the LLM says; a hypothesis that matches a probe key only
 * attaches its rationale, and one that matches nothing lands in `surplus` - listed honestly
 * as unexplored, never silently verified or dropped. So accepted/score/ranking stay
 * reproducible while the breadth stage stays genuinely generative.
 */
export interface Probe {
  key: string;
  title: string;
  kind: Hypothesis["kind"];
}

export interface ExplorerOutput {
  source: "llm" | "static";
  matched: Hypothesis[]; // bound to a probe by exact key
  surplus: Hypothesis[]; // proposed, but no probe exists for it (honest overflow)
}

export interface ExplorerOpts {
  client: Anthropic | null;
  ledger: CostLedger;
  goal: string;
  campaigns: CampaignRow[];
  memory: { subject: string; claim: string }[];
  probes: Probe[];
  /** Default: "llm" when a client exists, else "static". LIFT_EXPLORER=static forces static. */
  mode?: "llm" | "static";
}

function staticOutput(probes: Probe[]): ExplorerOutput {
  return {
    source: "static",
    matched: probes.map((p) => ({
      key: p.key,
      title: p.title,
      rationale: "Enumerated from the campaign catalog and known signals (deterministic fallback - no LLM).",
      kind: p.kind,
    })),
    surplus: [],
  };
}

export async function exploreHypotheses(opts: ExplorerOpts): Promise<ExplorerOutput> {
  const forceStatic = process.env.LIFT_EXPLORER === "static" || opts.mode === "static";
  if (forceStatic || !opts.client) return staticOutput(opts.probes);

  const memoryBlock = opts.memory.length
    ? `Prior VERIFIED insights (do not re-propose proven dead-ends):\n${opts.memory.map((m) => `- [${m.subject}] ${m.claim}`).join("\n")}\n`
    : "";
  const prompt =
    `You are the Explorer in a marketing opportunity engine for a fashion retailer. ` +
    `Goal: "${opts.goal}".\n` +
    `Campaign catalog:\n${opts.campaigns.map((c) => `- ${c.campaign_id}: ${c.name} (${c.target_description})`).join("\n")}\n` +
    memoryBlock +
    `Known investigation probes (echo the exact key when your idea maps to one): ${opts.probes.map((p) => p.key).join(", ")}.\n` +
    `Propose 5-10 hypotheses about what the marketing team should start, stop, or change. ` +
    `Breadth over depth - include at least one idea beyond the probe list if you see one. ` +
    `Reply with ONLY compact JSON: [{"key": "<probe key or a new SNAKE_CASE key>", "title": "<short>", ` +
    `"rationale": "<=20 words", "kind": "experiment"|"seasonality"|"segment"}]`;

  try {
    const resp = await opts.client.messages.create({
      model: config.models.fanout, // breadth is the cheap tier's job - Haiku, one call
      max_tokens: 900,
      temperature: 0, // stable hypothesis set run-to-run (rationale text may still vary slightly)
      messages: [{ role: "user", content: prompt }],
    });
    opts.ledger.add(resp.model, resp.usage.input_tokens, resp.usage.output_tokens);
    const text = resp.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const m = text.match(/\[[\s\S]*\]/);
    const parsed = JSON.parse(m ? m[0] : text) as Partial<Hypothesis>[];
    const probeKeys = new Set(opts.probes.map((p) => p.key));
    const seen = new Set<string>();
    const matched: Hypothesis[] = [];
    const surplus: Hypothesis[] = [];
    for (const h of parsed) {
      const key = String(h.key ?? "").trim();
      if (!key || seen.has(key)) continue; // dedup by key, first wins
      seen.add(key);
      const hyp: Hypothesis = {
        key,
        title: String(h.title ?? key),
        rationale: String(h.rationale ?? ""),
        kind: (["experiment", "seasonality", "segment"] as const).includes(h.kind as Hypothesis["kind"])
          ? (h.kind as Hypothesis["kind"])
          : "experiment",
      };
      (probeKeys.has(key) ? matched : surplus).push(hyp);
    }
    // Fail-safe: a probe the LLM ignored still gets a static hypothesis - never fewer probes.
    for (const p of opts.probes) {
      if (!seen.has(p.key)) {
        matched.push({ key: p.key, title: p.title, rationale: "Enumerated from the campaign catalog.", kind: p.kind });
      }
    }
    return { source: "llm", matched, surplus };
  } catch {
    return staticOutput(opts.probes); // parse/API failure → deterministic fallback, never a smaller run
  }
}
