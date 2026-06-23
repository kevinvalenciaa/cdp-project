import Anthropic from "@anthropic-ai/sdk";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { config } from "../shared/env.js";
import { CostLedger } from "../shared/cost.js";
import { callMcpTool, connectStats, connectWarehouse } from "../harness/mcp-client.js";
import { newClient } from "../harness/loop.js";
import type { EngineResult, Opportunity, Verdict } from "./types.js";

async function runSql(wh: Client, sql: string): Promise<Record<string, unknown>[]> {
  const r = await callMcpTool(wh, "run_sql", { sql });
  if (r.isError) throw new Error(`run_sql failed: ${r.text}`);
  return (JSON.parse(r.text).rows as Record<string, unknown>[]) ?? [];
}

async function callStats(stats: Client, tool: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const r = await callMcpTool(stats, tool, args);
  if (r.isError) throw new Error(`${tool} failed: ${r.text}`);
  return JSON.parse(r.text) as Record<string, unknown>;
}

const n = (v: unknown) => Number(v);

export interface CampaignRow {
  campaign_id: string;
  name: string;
  target_description: string;
}

export async function discoverCampaigns(wh: Client): Promise<CampaignRow[]> {
  return (await runSql(wh, "SELECT campaign_id, name, target_description FROM campaigns")) as unknown as CampaignRow[];
}

/** The Verifier stage applied to one campaign experiment. */
export async function verifyExperiment(
  wh: Client,
  stats: Client,
  campaign: { campaign_id: string; name: string; target_description: string },
): Promise<Opportunity> {
  const arms = await runSql(
    wh,
    `SELECT treatment, COUNT(*) AS n, SUM(converted) AS conv FROM campaign_sends WHERE campaign_id='${campaign.campaign_id}' GROUP BY treatment`,
  );
  const t = arms.find((a) => n(a.treatment) === 1);
  const c = arms.find((a) => n(a.treatment) === 0);
  const value = n(
    (await runSql(wh, `SELECT AVG(revenue) AS v FROM campaign_sends WHERE campaign_id='${campaign.campaign_id}' AND converted=1`))[0]?.v,
  );

  if (!t || !c || n(c.n) === 0) {
    return baseOpp(campaign.campaign_id, campaign.name, campaign.target_description, "experiment", n(t?.n) + n(c?.n), value, {
      verdict: "needs_test",
      reason: "No usable treatment/holdout split.",
    });
  }

  const test = await callStats(stats, "verify_lift_claim", { conv_t: n(t.conv), n_t: n(t.n), conv_c: n(c.conv), n_c: n(c.n) });
  const verdict = String(test.verdict) as Verdict;
  const accepted = verdict === "real_lift";
  const reach = n(t.n) + n(c.n);
  const upliftPp = n(test.abs_lift) * 100;
  const ci = (test.ci95 as number[]).map((x) => x * 100) as [number, number];

  return {
    key: campaign.campaign_id,
    title: campaign.name,
    segment: campaign.target_description,
    type: "experiment",
    reach,
    value,
    rawConversion: n(test.p_treatment) * 100,
    upliftPp,
    ci,
    pValue: n(test.p_value),
    verdict,
    accepted,
    score: accepted ? reach * value * Math.max(0, n(test.abs_lift)) : 0,
    reason: String(test.reason),
    evidence: { conv_t: n(t.conv), n_t: n(t.n), conv_c: n(c.conv), n_c: n(c.n) },
  };
}

function baseOpp(
  key: string,
  title: string,
  segment: string,
  type: Opportunity["type"],
  reach: number,
  value: number,
  extra: { verdict: Verdict; reason: string; rawConversion?: number | null },
): Opportunity {
  return {
    key,
    title,
    segment,
    type,
    reach,
    value,
    rawConversion: extra.rawConversion ?? null,
    upliftPp: null,
    ci: null,
    pValue: null,
    verdict: extra.verdict,
    accepted: false,
    score: 0,
    reason: extra.reason,
    evidence: {},
  };
}

/** A tempting time-series claim ("Q4 surge — double down") that the Verifier must reject. */
export async function seasonalityOpportunity(wh: Client, stats: Client): Promise<Opportunity> {
  const rows = await runSql(
    wh,
    `SELECT CAST(date_trunc('week', order_date) AS VARCHAR) AS wk, SUM(revenue) AS rev FROM orders GROUP BY 1 ORDER BY 1`,
  );
  const series = rows.map((r) => n(r.rev));
  const q4 = rows
    .map((r, i) => ({ i, wk: String(r.wk) }))
    .filter((r) => r.wk >= "2025-10-01" && r.wk < "2026-01-01")
    .map((r) => r.i);
  const windowStart = q4[0] ?? Math.max(0, series.length - 12);
  const windowEnd = (q4[q4.length - 1] ?? series.length - 1) + 1;

  const res = await callStats(stats, "assess_seasonality", { series, period: 52, window_start: windowStart, window_end: windowEnd });
  const value = n((await runSql(wh, "SELECT AVG(revenue) AS v FROM orders"))[0]?.v);
  const verdict = res.verdict === "explained_by_seasonality" ? "explained_by_seasonality" : "real_lift";
  return baseOpp("Q4_SURGE", "Double down on the Q4 order surge", "All customers, Q4", "seasonality", series.length, value, {
    verdict,
    reason: String(res.explanation),
  });
}

/** Archetype 3: an under-targeted high-value cohort — surfaced as "needs a holdout to test". */
export async function underservedOpportunity(wh: Client): Promise<Opportunity> {
  const row = (
    await runSql(
      wh,
      `SELECT COUNT(*) AS size, AVG(total_revenue) AS value,
        AVG(CASE WHEN customer_id IN (SELECT DISTINCT customer_id FROM campaign_sends) THEN 1.0 ELSE 0.0 END) AS coverage
       FROM customer_360 WHERE first_category='Workwear' AND CAST(substr(signup_date,1,4) AS INTEGER)=2026`,
    )
  )[0];
  const size = n(row?.size);
  const value = n(row?.value);
  return {
    ...baseOpp("UNDERSERVED_WORKWEAR", "Underserved: new workwear buyers", "First purchase Workwear, signed up 2026", "segment", size, value, {
      verdict: "needs_test",
      reason: `${size} high-value customers (avg LTV $${value.toFixed(0)}) barely targeted (${(n(row?.coverage) * 100).toFixed(0)}% send coverage). Design a holdout to measure incremental lift before scaling.`,
    }),
  };
}

/** The bare LLM (no statistical verifier): judges on raw conversion only — gets fooled by the trap. */
async function bareLlmJudge(client: Anthropic, ledger: CostLedger, opp: Opportunity): Promise<{ accepted: boolean; reason: string }> {
  if (opp.rawConversion == null) return { accepted: false, reason: "n/a" };
  const prompt =
    `You are a busy performance marketer doing a quick gut-check by conversion rate (no time to run experiments). ` +
    `Campaign "${opp.title}" reached ~${opp.reach} customers and converted at ${opp.rawConversion.toFixed(1)}%. ` +
    `Judging by conversion rate alone, is this a strong-performing campaign worth scaling spend on? ` +
    `Reply with ONLY compact JSON: {"accept": true|false, "reason": "<=10 words"}.`;
  const resp = await client.messages.create({
    model: config.models.fanout,
    max_tokens: 60,
    messages: [{ role: "user", content: prompt }],
  });
  ledger.add(resp.model, resp.usage.input_tokens, resp.usage.output_tokens);
  const text = resp.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  try {
    const m = text.match(/\{[\s\S]*\}/);
    const j = JSON.parse(m ? m[0] : text);
    return { accepted: Boolean(j.accept), reason: String(j.reason ?? "") };
  } catch {
    return { accepted: /accept|yes|invest/i.test(text), reason: text.slice(0, 60) };
  }
}

export async function runEngine(opts: { withBareLlmContrast?: boolean } = {}): Promise<EngineResult> {
  const wh = await connectWarehouse();
  const stats = await connectStats();
  const client = newClient();
  const ledger = new CostLedger();

  const campaigns = (await runSql(wh, "SELECT campaign_id, name, target_description FROM campaigns")) as unknown as {
    campaign_id: string;
    name: string;
    target_description: string;
  }[];

  const opps: Opportunity[] = [];
  for (const c of campaigns) opps.push(await verifyExperiment(wh, stats, c));
  opps.push(await seasonalityOpportunity(wh, stats));
  opps.push(await underservedOpportunity(wh));

  if (opts.withBareLlmContrast) {
    for (const o of opps) o.bareLlm = await bareLlmJudge(client, ledger, o);
  }

  await wh.close();
  await stats.close();

  const ranked = opps.filter((o) => o.accepted).sort((a, b) => b.score - a.score);
  const rejected = opps.filter((o) => !o.accepted).sort((a, b) => b.reach * b.value - a.reach * a.value);

  return { goal: "Grow second purchases from one-time buyers", ranked, rejected, contrastUsd: ledger.totalUsd(), generatedFromSeed: config.seed };
}
