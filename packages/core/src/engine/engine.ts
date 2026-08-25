import Anthropic from "@anthropic-ai/sdk";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { config } from "../shared/env.js";
import { CostLedger } from "../shared/cost.js";
import { mapLimit } from "../shared/concurrency.js";
import { callMcpTool, connectStats, connectWarehouse } from "../harness/mcp-client.js";
import { newClient } from "../harness/loop.js";
import { Memory } from "../memory/store.js";
import { DEAD_END_VERDICTS, toInsight } from "../memory/insights.js";
import { emptyProvenance, queryFingerprint, type Provenance, type QueryProvenance } from "./provenance.js";
import { prioritize, scoreOpportunity } from "./prioritize.js";
import { exploreHypotheses, type Probe } from "./explorer.js";
import { checkGroundedness } from "./groundedness.js";
import type { EngineResult, Hypothesis, Opportunity, Verdict } from "./types.js";

interface SqlResult {
  rows: Record<string, unknown>[];
  sql: string;
  resultHash: string;
}

async function runSql(wh: Client, sql: string): Promise<SqlResult> {
  const r = await callMcpTool(wh, "run_sql", { sql });
  if (r.isError) throw new Error(`run_sql failed: ${r.text}`);
  const parsed = JSON.parse(r.text) as { rows?: Record<string, unknown>[]; resultHash?: string };
  return { rows: parsed.rows ?? [], sql, resultHash: String(parsed.resultHash ?? "") };
}

function toProvenance(results: SqlResult[]): QueryProvenance[] {
  return results.map((r) => ({ sql: r.sql, resultHash: r.resultHash, fingerprint: queryFingerprint(r.sql, r.resultHash) }));
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
  return (await runSql(wh, "SELECT campaign_id, name, target_description FROM campaigns ORDER BY campaign_id")).rows as unknown as CampaignRow[];
}

/** The Verifier stage applied to one campaign experiment. */
export async function verifyExperiment(
  wh: Client,
  stats: Client,
  campaign: { campaign_id: string; name: string; target_description: string },
): Promise<Opportunity> {
  // ORDER BY keeps row order (and thus the result hash / fingerprint) stable run-to-run.
  const armsRes = await runSql(
    wh,
    `SELECT treatment, COUNT(*) AS n, SUM(converted) AS conv FROM campaign_sends WHERE campaign_id='${campaign.campaign_id}' GROUP BY treatment ORDER BY treatment`,
  );
  const arms = armsRes.rows;
  const t = arms.find((a) => n(a.treatment) === 1);
  const c = arms.find((a) => n(a.treatment) === 0);
  const valueRes = await runSql(
    wh,
    `SELECT AVG(revenue) AS v FROM campaign_sends WHERE campaign_id='${campaign.campaign_id}' AND converted=1`,
  );
  const value = n(valueRes.rows[0]?.v);
  const queries = toProvenance([armsRes, valueRes]);

  if (!t || !c || n(c.n) === 0) {
    return baseOpp(campaign.campaign_id, campaign.name, campaign.target_description, "experiment", n(t?.n) + n(c?.n), value, {
      verdict: "needs_test",
      reason: "No usable treatment/holdout split.",
      provenance: { queries, stats: null },
    });
  }

  const statsArgs = { conv_t: n(t.conv), n_t: n(t.n), conv_c: n(c.conv), n_c: n(c.n) };
  const test = await callStats(stats, "verify_lift_claim", statsArgs);
  const verdict = String(test.verdict) as Verdict;
  const accepted = verdict === "real_lift";
  const reach = n(t.n) + n(c.n);
  const upliftPp = n(test.abs_lift) * 100;
  const ci = (test.ci95 as number[]).map((x) => x * 100) as [number, number];
  const rawConversion = n(test.p_treatment) * 100;

  return {
    key: campaign.campaign_id,
    title: campaign.name,
    segment: campaign.target_description,
    type: "experiment",
    reach,
    value,
    rawConversion,
    upliftPp,
    ci,
    pValue: n(test.p_value),
    verdict,
    accepted,
    score: scoreOpportunity({ reach, value, accepted }, n(test.abs_lift)),
    reason: String(test.reason),
    naiveClaim: `Campaign "${campaign.name}" reached ~${reach} customers and converted at ${rawConversion.toFixed(1)}%.`,
    evidence: statsArgs,
    provenance: { queries, stats: { tool: "verify_lift_claim", args: statsArgs, verdict } },
  };
}

function baseOpp(
  key: string,
  title: string,
  segment: string,
  type: Opportunity["type"],
  reach: number,
  value: number,
  extra: {
    verdict: Verdict;
    reason: string;
    rawConversion?: number | null;
    naiveClaim?: string | null;
    evidence?: Record<string, unknown>;
    provenance?: Provenance;
  },
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
    naiveClaim: extra.naiveClaim ?? null,
    evidence: extra.evidence ?? {},
    provenance: extra.provenance ?? emptyProvenance(),
  };
}

/** A tempting time-series claim ("Q4 surge - double down") that the Verifier must reject. */
export async function seasonalityOpportunity(wh: Client, stats: Client): Promise<Opportunity> {
  const weeklyRes = await runSql(
    wh,
    `SELECT CAST(date_trunc('week', order_date) AS VARCHAR) AS wk, SUM(revenue) AS rev FROM orders GROUP BY 1 ORDER BY 1`,
  );
  const rows = weeklyRes.rows;
  const series = rows.map((r) => n(r.rev));
  const q4 = rows
    .map((r, i) => ({ i, wk: String(r.wk) }))
    .filter((r) => r.wk >= "2025-10-01" && r.wk < "2026-01-01")
    .map((r) => r.i);
  const windowStart = q4[0] ?? Math.max(0, series.length - 12);
  const windowEnd = (q4[q4.length - 1] ?? series.length - 1) + 1;

  const statsArgs = { period: 52, window_start: windowStart, window_end: windowEnd, series_len: series.length };
  const res = await callStats(stats, "assess_seasonality", { series, period: 52, window_start: windowStart, window_end: windowEnd });
  const valueRes = await runSql(wh, "SELECT AVG(revenue) AS v FROM orders");
  const value = n(valueRes.rows[0]?.v);
  const verdict = res.verdict === "explained_by_seasonality" ? "explained_by_seasonality" : "real_lift";
  const rawChangePct = n(res.raw_change) * 100;
  // The dashboard-facing stat: month-over-month growth into the surge window - the way
  // naive reporting actually presents revenue, and exactly the framing that hides
  // seasonality (each MoM delta looks like momentum; only history reveals the cycle).
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  const intoWindow = series.slice(windowStart, Math.min(windowStart + 8, windowEnd));
  const beforeWindow = series.slice(Math.max(0, windowStart - 8), windowStart);
  const momPct = (mean(intoWindow) / Math.max(1, mean(beforeWindow)) - 1) * 100;
  return baseOpp("Q4_SURGE", "Double down on the Q4 order surge", "All customers, Q4", "seasonality", series.length, value, {
    verdict,
    reason: String(res.explanation),
    // The naive claim is what a MoM dashboard shows - deliberately NOT the STL verdict,
    // and deliberately without calendar labels: naive reporting says "revenue is up 60%
    // over the prior two months", not "it's Q4" - spotting the cycle is the Verifier's job.
    naiveClaim: `Order revenue over the past two months is up +${momPct.toFixed(0)}% versus the two months prior, and it is still climbing week over week. The current campaign mix is clearly working.`,
    evidence: {
      weeks: series.length,
      rawChangePct,
      fracSeasonal: n(res.frac_explained_by_seasonality),
      seasonalStrength: n(res.seasonal_strength),
    },
    // args records the window, not the full series: the weekly-revenue query fingerprint already pins it.
    provenance: { queries: toProvenance([weeklyRes, valueRes]), stats: { tool: "assess_seasonality", args: statsArgs, verdict } },
  });
}

/** Archetype 3: an under-targeted high-value cohort - surfaced as "needs a holdout to test". */
export async function underservedOpportunity(wh: Client): Promise<Opportunity> {
  const res = await runSql(
    wh,
    `SELECT COUNT(*) AS size, AVG(total_revenue) AS value,
      AVG(CASE WHEN customer_id IN (SELECT DISTINCT customer_id FROM campaign_sends) THEN 1.0 ELSE 0.0 END) AS coverage
     FROM customer_360 WHERE first_category='Workwear' AND CAST(substr(signup_date,1,4) AS INTEGER)=2026`,
  );
  const row = res.rows[0];
  const size = n(row?.size);
  const value = n(row?.value);
  const coveragePct = n(row?.coverage) * 100;
  return baseOpp("UNDERSERVED_WORKWEAR", "Underserved: new workwear buyers", "First purchase Workwear, signed up 2026", "segment", size, value, {
    verdict: "needs_test",
    reason: `${size} high-value customers (avg LTV $${value.toFixed(0)}) barely targeted (${coveragePct.toFixed(0)}% send coverage). Design a holdout to measure incremental lift before scaling.`,
    naiveClaim: null, // no performance claim exists yet - nothing for a naive judge to buy
    evidence: { size, avgLtv: value, coveragePct },
    provenance: { queries: toProvenance([res]), stats: null },
  });
}

/**
 * The bare LLM (no statistical verifier): judges the naive claim only - reach and raw
 * numbers, never the verdict, p-values, or STL output. This is the contrast foil the demo
 * measures the Verifier against. Empirically (2026 models): it ACCEPTS the incrementality
 * trap (high raw conversion looks great) but on time-series spikes it hedges "can't tell
 * without the baseline" - which is the point: it knows seasonality exists yet cannot check
 * it, while the Verifier decomposes the actual series. Returns null when there is no claim.
 */
export async function bareLlmJudge(
  client: Anthropic,
  ledger: CostLedger,
  opp: Opportunity,
): Promise<{ accepted: boolean; reason: string } | null> {
  if (opp.naiveClaim == null) return null;
  // The bare judge's naivety is INFORMATIONAL, by construction: it sees exactly what a
  // dashboard reports and has no access to the historical series (the Verifier's STL has
  // the full history - that asymmetry IS the demo). For time-series claims we state that
  // situation plainly; "check for seasonality" is impossible without the data to check.
  const prompt =
    opp.type === "seasonality"
      ? `You are a marketer reviewing this month's dashboard. The numbers below are ALL the data you have - ` +
        `there is no historical series to consult, so judge them at face value. ` +
        `${opp.naiveClaim} ` +
        `On these numbers, is this a genuine performance improvement worth leaning into? ` +
        `Reply with ONLY compact JSON: {"accept": true|false, "reason": "<=10 words"}.`
      : `You are a busy performance marketer doing a quick gut-check (no time to run experiments). ` +
        `${opp.naiveClaim} ` +
        `Judging by these numbers alone, is this worth scaling spend on? ` +
        `Reply with ONLY compact JSON: {"accept": true|false, "reason": "<=10 words"}.`;
  const resp = await client.messages.create({
    model: config.models.fanout,
    max_tokens: 60,
    temperature: 0, // pin the contrast: the demo asserts this verdict, so it must be stable
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

export interface EngineOpts {
  withBareLlmContrast?: boolean;
  /** Verifier check #2 (LLM claim-vs-evidence). Default: on whenever the contrast is on and a key exists. */
  withGroundedness?: boolean;
  /** "llm" needs ANTHROPIC_API_KEY; "static" is deterministic. Default: llm when a key exists. */
  explorerMode?: "llm" | "static";
  /** Consult + write compounding memory. Default OFF so gates/goldens stay independent of prior runs. */
  memory?: boolean;
  goal?: string;
  runId?: string;
  /** Durable worker resume input. Completed stages are treated as immutable. */
  resume?: {
    explorer?: {
      source: "llm" | "static";
      matched: Hypothesis[];
      surplus: Hypothesis[];
    };
    opportunities?: Opportunity[];
  };
  /** Verified tenant-scoped memory supplied by the durable product worker. */
  priorInsights?: Array<{
    subject: string;
    claim: string;
    verdict: string;
  }>;
}

/** Concurrency for per-candidate verification: one warehouse MCP + one stats server - 4 keeps them comfortable. */
const VERIFY_CONCURRENCY = Number(process.env.VERIFY_CONCURRENCY ?? 4);

export async function runEngine(opts: EngineOpts = {}): Promise<EngineResult> {
  const wh = await connectWarehouse();
  const stats = await connectStats();
  // Lazy client: the statistical pipeline must run without a key; only side-channel LLM stages need one.
  const client = config.anthropicApiKey ? newClient() : null;
  if (opts.withBareLlmContrast && !client) throw new Error("ANTHROPIC_API_KEY is not set (add it to .env).");
  const explorerLedger = new CostLedger();
  const bareLlmLedger = new CostLedger();
  const groundedLedger = new CostLedger();
  const goal = opts.goal ?? "Grow second purchases from one-time buyers";
  const memory = opts.memory ? await Memory.open() : null;

  try {
    const campaigns = await discoverCampaigns(wh);
    const candidates: { probe: Probe; make: () => Promise<Opportunity> }[] = [
      ...campaigns.map((c) => ({
        probe: { key: c.campaign_id, title: c.name, kind: "experiment" as const },
        make: () => verifyExperiment(wh, stats, c),
      })),
      { probe: { key: "Q4_SURGE", title: "Double down on the Q4 order surge", kind: "seasonality" as const }, make: () => seasonalityOpportunity(wh, stats) },
      { probe: { key: "UNDERSERVED_WORKWEAR", title: "Underserved: new workwear buyers", kind: "segment" as const }, make: () => underservedOpportunity(wh) },
    ];

    // STAGE 1 · Explorer - annotate/overflow only; the probe list is never altered by the LLM.
    const prior = memory ? await memory.getValid() : [];
    const explorer = await exploreHypotheses({
      client,
      ledger: explorerLedger,
      goal,
      campaigns,
      memory: prior.map((p) => ({ subject: p.subject, claim: p.claim })),
      probes: candidates.map((c) => c.probe),
      mode: opts.explorerMode,
    });
    const hypothesisByKey = new Map(explorer.matched.map((h) => [h.key, h]));

    // Memory skip-filter: dead ends already proven in a prior run are not re-litigated.
    const skippedFromMemory: { subject: string; claim: string }[] = [];
    const toVerify = candidates.filter((cand) => {
      const known = prior.find((p) => p.subject === cand.probe.key && DEAD_END_VERDICTS.has(p.verdict));
      if (known) skippedFromMemory.push({ subject: cand.probe.key, claim: known.claim });
      return !known;
    });

    // STAGE 2 · Investigate/Verify - parallel, order-preserving (output order = candidate order).
    const opps = await mapLimit(toVerify, VERIFY_CONCURRENCY, (c) => c.make());
    for (const o of opps) {
      const h = hypothesisByKey.get(o.key);
      if (h) o.hypothesis = { rationale: h.rationale, source: explorer.source };
    }

    if (opts.withBareLlmContrast && client) {
      await mapLimit(opps, VERIFY_CONCURRENCY, async (o) => {
        const b = await bareLlmJudge(client, bareLlmLedger, o);
        if (b) o.bareLlm = b;
      });
    }

    // Verifier check #2 - groundedness (demote-only; see groundedness.ts).
    const withGroundedness = opts.withGroundedness ?? (Boolean(opts.withBareLlmContrast) && client != null);
    if (withGroundedness && client) {
      await mapLimit(
        opps.filter((o) => o.accepted),
        VERIFY_CONCURRENCY,
        async (o) => {
          o.grounded = await checkGroundedness(client, groundedLedger, o);
          if (o.grounded.verdict === "demote") {
            o.accepted = false;
            o.score = 0;
          }
        },
      );
    } else {
      for (const o of opps) if (o.accepted) o.grounded = { verdict: "n/a", reason: "skipped (no API key or disabled)" };
    }

    // STAGE 3 · Prioritize.
    const { ranked, rejected } = prioritize(opps);

    if (memory) {
      const runId = opts.runId ?? `engine-${Date.now()}`;
      for (const o of opps) {
        try {
          await memory.write(toInsight(o, runId));
        } catch {
          /* gate rejection - ignore */
        }
      }
    }

    const costByStage = {
      explorer: explorerLedger.totalUsd(),
      bareLlm: bareLlmLedger.totalUsd(),
      groundedness: groundedLedger.totalUsd(),
    };
    return {
      goal,
      ranked,
      rejected,
      contrastUsd: costByStage.explorer + costByStage.bareLlm + costByStage.groundedness,
      generatedFromSeed: config.seed,
      explorer: { source: explorer.source, surplus: explorer.surplus },
      skippedFromMemory,
      costByStage,
    };
  } finally {
    await wh.close();
    await stats.close();
    memory?.close();
  }
}
