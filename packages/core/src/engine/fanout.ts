import type Anthropic from "@anthropic-ai/sdk";
import { config } from "../shared/env.js";
import { CostLedger } from "../shared/cost.js";
import type { Creative, CreativeStyle } from "./creatives.js";

export interface Classification {
  id: string;
  intendedStyle: CreativeStyle;
  style: string;
  discountLed: boolean;
}

export interface FanoutResult {
  classifications: Classification[];
  costUsd: number;
  wallMs: number;
  avgCallMs: number;
  agreement: number; // share where classified style == intended style
  styleCounts: Record<string, number>;
  discountLedShare: number;
}

/** Run an async fn over items with a bounded concurrency pool (rate-limit friendly). */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i] as T);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function classifyOne(client: Anthropic, ledger: CostLedger, creative: Creative): Promise<Classification> {
  const resp = await client.messages.create({
    model: config.models.fanout,
    max_tokens: 40,
    messages: [
      {
        role: "user",
        content:
          `Classify this fashion ad creative. Return ONLY compact JSON ` +
          `{"style": one of ["product_drop","evergreen","promotional","ugc"], "discount_led": true|false}. ` +
          `discount_led = does the creative LEAD with a discount, % off, sale, or promo code?\n` +
          `Creative: "${creative.text}"`,
      },
    ],
  });
  ledger.add(resp.model, resp.usage.input_tokens, resp.usage.output_tokens);
  const text = resp.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  let style = "unknown";
  let discountLed = false;
  try {
    const m = text.match(/\{[\s\S]*\}/);
    const j = JSON.parse(m ? m[0] : text);
    style = String(j.style ?? "unknown");
    discountLed = Boolean(j.discount_led);
  } catch {
    /* leave defaults */
  }
  return { id: creative.id, intendedStyle: creative.intendedStyle, style, discountLed };
}

/**
 * Fan-out: hundreds of parallel cheap-model (Haiku) calls, each classifying ONE creative
 * — instead of standing up a vector store. See docs/FANOUT_VS_RAG.md.
 */
export async function fanoutClassify(
  client: Anthropic,
  creatives: Creative[],
  concurrency = 8,
): Promise<FanoutResult> {
  const ledger = new CostLedger();
  const start = Date.now();
  let totalCallMs = 0;
  const classifications = await mapLimit(creatives, concurrency, async (c) => {
    const t0 = Date.now();
    const r = await classifyOne(client, ledger, c);
    totalCallMs += Date.now() - t0;
    return r;
  });
  const wallMs = Date.now() - start;

  const agreement = classifications.filter((c) => c.style === c.intendedStyle).length / classifications.length;
  const styleCounts: Record<string, number> = {};
  for (const c of classifications) styleCounts[c.style] = (styleCounts[c.style] ?? 0) + 1;
  const discountLedShare = classifications.filter((c) => c.discountLed).length / classifications.length;

  return {
    classifications,
    costUsd: ledger.totalUsd(),
    wallMs,
    avgCallMs: Math.round(totalCallMs / classifications.length),
    agreement,
    styleCounts,
    discountLedShare,
  };
}
