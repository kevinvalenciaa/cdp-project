import type Anthropic from "@anthropic-ai/sdk";
import { config } from "../shared/env.js";
import type { CostLedger } from "../shared/cost.js";
import type { Opportunity } from "../engine/types.js";
import type { AudienceDef } from "./audience.js";
import type { Variant } from "./connectors.js";

/** The Agentic CDP's "draft work": a concise creative brief for a verified opportunity. */
export async function draftCreativeBrief(
  client: Anthropic,
  ledger: CostLedger,
  opp: Opportunity,
  audience: AudienceDef,
): Promise<string> {
  const resp = await client.messages.create({
    model: config.models.fanout,
    max_tokens: 220,
    messages: [
      {
        role: "user",
        content:
          `Write a concise marketing creative brief (max 5 short lines) for a fashion retailer.\n` +
          `Opportunity: ${opp.title} - verified +${opp.upliftPp?.toFixed(1)}pp incremental lift.\n` +
          `Audience: ${audience.label} (${audience.persuadableReach} persuadable customers, channel: ${audience.channel}).\n` +
          `Stay aspirational and on-brand. Do NOT propose discounts on premium products. Output ONLY the brief.`,
      },
    ],
  });
  ledger.add(resp.model, resp.usage.input_tokens, resp.usage.output_tokens);
  return resp.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
}

/** The AMP-analog: turn the brief into >=2 on-brand message variants. */
export async function draftVariants(
  client: Anthropic,
  ledger: CostLedger,
  brief: string,
  channel: string,
  count = 2,
): Promise<Variant[]> {
  const limit = channel === "sms" ? 160 : 240;
  const resp = await client.messages.create({
    model: config.models.fanout,
    max_tokens: 320,
    messages: [
      {
        role: "user",
        content:
          `From this brief, write ${count} DISTINCT ${channel} message variants (each <= ${limit} chars). ` +
          `On-brand and aspirational; no discounts on premium products.\n` +
          `Brief:\n${brief}\n\n` +
          `Return ONLY a JSON array like [{"text":"..."}, {"text":"..."}].`,
      },
    ],
  });
  ledger.add(resp.model, resp.usage.input_tokens, resp.usage.output_tokens);
  const text = resp.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  try {
    const m = text.match(/\[[\s\S]*\]/);
    const arr = JSON.parse(m ? m[0] : text) as { text: string }[];
    return arr.map((v, i) => ({ id: `V${i + 1}`, channel, text: String(v.text) }));
  } catch {
    return [{ id: "V1", channel, text: text.slice(0, limit) }];
  }
}
