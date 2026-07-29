import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Db } from "../shared/db.js";
import { num } from "../shared/db.js";
import { CALENDAR, CAMPAIGNS, SEASONALITY, UNDERSERVED, UPCOMING_DROPS } from "./config.js";

export interface CampaignStat {
  campaign_id: string;
  n_treat: number;
  n_ctrl: number;
  rate_treat: number;
  rate_ctrl: number;
  lift: number;
}

export async function campaignStats(db: Db): Promise<Map<string, CampaignStat>> {
  const rows = await db.all<Record<string, unknown>>(`
    SELECT campaign_id,
      SUM(CASE WHEN treatment=1 THEN 1 ELSE 0 END) AS n_treat,
      SUM(CASE WHEN treatment=0 THEN 1 ELSE 0 END) AS n_ctrl,
      AVG(CASE WHEN treatment=1 THEN converted END) AS rate_treat,
      AVG(CASE WHEN treatment=0 THEN converted END) AS rate_ctrl
    FROM campaign_sends GROUP BY campaign_id;
  `);
  const map = new Map<string, CampaignStat>();
  for (const r of rows) {
    const rt = num(r.rate_treat);
    const rc = num(r.rate_ctrl);
    map.set(String(r.campaign_id), {
      campaign_id: String(r.campaign_id),
      n_treat: num(r.n_treat),
      n_ctrl: num(r.n_ctrl),
      rate_treat: rt,
      rate_ctrl: rc,
      lift: rt - rc,
    });
  }
  return map;
}

export async function archetype2Churn(db: Db): Promise<{ multi: number; single: number }> {
  const rows = await db.all<Record<string, unknown>>(`
    SELECT (categories_purchased >= 2) AS multi,
           AVG(CASE WHEN is_churn_risk THEN 1.0 ELSE 0.0 END) AS churn_rate
    FROM customer_360 WHERE n_orders >= 1 GROUP BY 1;
  `);
  let multi = Number.NaN;
  let single = Number.NaN;
  for (const r of rows) {
    if (r.multi === true) multi = num(r.churn_rate);
    else single = num(r.churn_rate);
  }
  return { multi, single };
}

export async function underservedStats(db: Db): Promise<{ size: number; avgValue: number; sendCoverage: number }> {
  const row = await db.one<Record<string, unknown>>(`
    SELECT COUNT(*) AS size,
           AVG(total_revenue) AS avg_value,
           AVG(CASE WHEN customer_id IN (SELECT DISTINCT customer_id FROM campaign_sends) THEN 1.0 ELSE 0.0 END) AS send_coverage
    FROM customer_360
    WHERE first_category = 'Workwear' AND CAST(substr(signup_date, 1, 4) AS INTEGER) = 2026;
  `);
  return { size: num(row?.size), avgValue: num(row?.avg_value), sendCoverage: num(row?.send_coverage) };
}

export async function seasonalityInflation(db: Db): Promise<number> {
  // Q4 (Oct–Dec) average daily revenue vs full-year average daily revenue.
  const row = await db.one<Record<string, unknown>>(`
    WITH daily AS (
      SELECT order_date, SUM(revenue) AS rev,
             CAST(strftime(order_date, '%m') AS INTEGER) AS mon
      FROM orders GROUP BY order_date
    )
    SELECT AVG(CASE WHEN mon IN (10,11,12) THEN rev END) AS q4_daily,
           AVG(rev) AS all_daily
    FROM daily;
  `);
  const q4 = num(row?.q4_daily);
  const all = num(row?.all_daily);
  return q4 / all - 1;
}

export interface ChannelPreferenceStat {
  campaign_id: string;
  channel: string;
  responderRate: number; // treated conversion rate among channel responders
  nonResponderRate: number; // treated conversion rate among non-responders
  ratio: number;
}

/** Treated conversion by channel-responder flag — proves the planted channel signal is in-data. */
export async function channelPreferenceStats(db: Db): Promise<Map<string, ChannelPreferenceStat>> {
  const rows = await db.all<Record<string, unknown>>(`
    SELECT s.campaign_id, cp.channel,
      AVG(CASE WHEN (cp.channel='sms' AND c.sms_responder) OR (cp.channel='email' AND c.email_responder) THEN s.converted END) AS responder_rate,
      AVG(CASE WHEN NOT ((cp.channel='sms' AND c.sms_responder) OR (cp.channel='email' AND c.email_responder)) THEN s.converted END) AS non_responder_rate
    FROM campaign_sends s
    JOIN customers c USING (customer_id)
    JOIN campaigns cp USING (campaign_id)
    WHERE s.treatment = 1 AND cp.channel IN ('sms', 'email')
    GROUP BY s.campaign_id, cp.channel;
  `);
  const map = new Map<string, ChannelPreferenceStat>();
  for (const r of rows) {
    const rr = num(r.responder_rate);
    const nr = num(r.non_responder_rate);
    map.set(String(r.campaign_id), {
      campaign_id: String(r.campaign_id),
      channel: String(r.channel),
      responderRate: rr,
      nonResponderRate: nr,
      ratio: nr > 0 ? rr / nr : Number.POSITIVE_INFINITY,
    });
  }
  return map;
}

export async function guardrailStats(db: Db): Promise<{ count: number; example: string }> {
  const row = await db.one<Record<string, unknown>>(`
    SELECT COUNT(*) AS c,
           (SELECT name FROM products WHERE never_discount AND is_premium ORDER BY price DESC LIMIT 1) AS example
    FROM products WHERE never_discount AND is_premium;
  `);
  return { count: num(row?.c), example: String(row?.example ?? "n/a") };
}

export async function writeGroundTruth(db: Db, repoRoot: string): Promise<void> {
  const stats = await campaignStats(db);
  const churn = await archetype2Churn(db);
  const under = await underservedStats(db);
  const seasonal = await seasonalityInflation(db);
  const guard = await guardrailStats(db);
  const channel = await channelPreferenceStats(db);

  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  const pp = (x: number) => `${(x * 100).toFixed(1)}pp`;

  const campaignTable = CAMPAIGNS.map((c) => {
    const s = stats.get(c.id);
    return `| \`${c.id}\` | ${c.audience} | ${pct(c.treatmentRate)} / ${pct(c.holdoutRate)} | ${pp(c.treatmentRate - c.holdoutRate)} | ${s ? `${pct(s.rate_treat)} / ${pct(s.rate_ctrl)} (n=${s.n_treat}/${s.n_ctrl})` : "—"} | ${s ? pp(s.lift) : "—"} | **${c.expectedVerdict}** |`;
  }).join("\n");

  const md = `# GROUND_TRUTH.md — the answer key

> Auto-generated by \`pnpm seed\`. The agents never read this; it is how we *prove* the
> system is right. Every Verifier rejection and uplift estimate is checked against these
> planted values by \`pnpm ground-truth\`.

**Calendar.** Data ${CALENDAR.dataStart} → "today" = ${CALENDAR.today}. Churn window = ${CALENDAR.churnWindowDays} days.

## 1. Seasonality (the time-series false positive)
A strong yearly curve (amplitude ${SEASONALITY.yearlyAmplitude}, peak ~day ${SEASONALITY.peakDayOfYear} / late Nov) plus a weekend bump. **Realized Q4 daily-revenue inflation vs the yearly average: ${pct(seasonal)}.** A naive analyst "finds" a Q4 surge; the Verifier's STL decomposition must absorb it into the seasonal component and report **"explained by seasonality, not a real change."**

## 2. Experiments (planted incremental lift)
| Campaign | Audience | Planted T/C rate | Planted lift | Realized T/C rate | Realized lift | Expected verdict |
|---|---|---|---|---|---|---|
${campaignTable}

- **\`SECOND_PURCHASE_SMS\`** — the genuine headline opportunity (Hightouch's "drive more second purchases"). Real ~+6pp lift, should pass.
- **\`VIP_LOYALTY_BLAST\`** — the **TRAP**: ~42% raw conversion but **~0 incremental lift** (they convert anyway). Naive propensity ranks it #1; the uplift engine must **demote it** (lift CI includes 0), and the bare LLM (no verifier) should accept it.
- **\`CROSS_CATEGORY_SMS\`** — real ~+4pp lift, supports the churn-prevention cross-sell archetype.
- **\`RETARGET_NEAR_MISS\`** — ~+1pp, underpowered → **not significant** → must be rejected.
- **\`SPRING_DROP_CREATIVE\` vs \`SPRING_EVERGREEN_CREATIVE\`** — product-drop creative converts higher than evergreen on a similar audience (archetype 1).

## 3. The three Hightouch archetypes
1. **New product launch** — product-drop creative beats evergreen (see campaigns above); upcoming drops: ${UPCOMING_DROPS.map((d) => `${d.collection} (${d.launchDate})`).join(", ")}.
2. **Churn-prevention cross-sell** — multi-category buyers churn **less**: realized churn ${pct(churn.multi)} (multi) vs ${pct(churn.single)} (single). Cross-category SMS drives a real lift.
3. **Underserved audience** — "${UNDERSERVED.cohortName}" (new workwear buyers, signup 2026): realized size **${under.size}**, avg value **$${under.avgValue.toFixed(0)}**, campaign send coverage **${pct(under.sendCoverage)}** (barely targeted).

## 4. Guardrail bait
**${guard.count}** premium SKUs are flagged \`never_discount\` (e.g., *${guard.example}*). A proposal to discount these must be **blocked** by the composable-context guardrail (Phase 4).

## 5. Channel-preference signal
Treated conversions land preferentially on channel responders (planted weight 3×), so "which customers respond to SMS" is discoverable **in-data**, and activation's persuadable filter is load-bearing, not cosmetic. Control arms are uniform (organic conversion is channel-independent). Realized treated conversion, responder vs non-responder:
${[...channel.values()].map((c) => `- \`${c.campaign_id}\` (${c.channel}): ${pct(c.responderRate)} vs ${pct(c.nonResponderRate)} (${c.ratio.toFixed(1)}×)`).join("\n")}

## Schema naming vs the spec's suggested tables
The spec sketch suggests \`users/events/campaigns/sends/conversions/segments\`. This warehouse models the same six concepts with warehouse-native naming — a deliberate deviation, documented here:
| Spec concept | Here | Note |
|---|---|---|
| \`users\` | \`customers\` | plus the derived \`customer_360\` view |
| \`events\` | \`orders\` + \`order_items\` | purchase events; no separate clickstream table |
| \`campaigns\` | \`campaigns\` | 1:1 |
| \`sends\` | \`campaign_sends\` | includes treatment/holdout arm + variant |
| \`conversions\` | columns on \`campaign_sends\` | \`converted\`, \`converted_at\`, \`revenue\` — a conversion is a property of a send, not a separate entity |
| \`segments\` | \`customer_360\` view + TS predicates | segments are governed queries, not a materialized table |

**Note on the trap:** the spec suggests planting an audience that *never converts* regardless of treatment. We invert it: \`VIP_LOYALTY_BLAST\` **always converts (~42%) with zero incremental lift** — the same durable lesson for memory ("not persuadable — don't spend here"), but a sharper demo because raw conversion actively *tempts* a naive ranker.

## Expected end-to-end behavior
- Rank by reach × value × **uplift**: \`SECOND_PURCHASE_SMS\` / \`CROSS_CATEGORY_SMS\` / \`SPRING_DROP_CREATIVE\` high; \`VIP_LOYALTY_BLAST\` demoted.
- Verifier **rejects** the seasonality spike and the VIP trap with numeric reasons. The bare LLM **accepts the VIP trap** (raw conversion looks great); on the seasonal spike it can only hedge — it lacks the series and the statistics to verify, while the Verifier decomposes and quantifies it.
- Memory records the rejected trap so a second run does not re-surface it.
`;

  const out = resolve(repoRoot, "packages/core/GROUND_TRUTH.md");
  writeFileSync(out, md, "utf8");
  console.log(`[seed] wrote ${out}`);
}
