import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { callMcpTool } from "../harness/mcp-client.js";
import { FREQUENCY_CAP } from "../delivery/compile.js";

/**
 * The server half of the frequency cap — deterministic arithmetic over the
 * send ledger, replacing the prose rule that used to sit in guardrails.yaml
 * (where an LLM graded creative copy against "max 2 per week", which a message
 * body cannot violate). The device half is @lift/sdk frequency.ts; both derive
 * from the same FREQUENCY_CAP constant.
 *
 * The window anchors on MAX(sent_at) — the newest send in the warehouse — not
 * on the wall clock. The seeded calendar is fixed, so a wall-clock window
 * would silently exclude nobody forever; the data anchor is deterministic AND
 * actually demonstrates the exclusion.
 */

export interface CapResult {
  ruleId: string;
  windowDays: number;
  maxSends: number;
  /** Audience members excluded because they are at the cap. */
  excluded: number;
  /** The window's anchor date (newest send in campaign_sends). */
  anchor: string;
}

export async function applyFrequencyCap(
  wh: Client,
  filterSql: string,
  persuadableSql: string,
  cap: { ruleId: string; windowDays: number; maxSends: number } = {
    ruleId: FREQUENCY_CAP.id,
    windowDays: FREQUENCY_CAP.windowDays,
    maxSends: FREQUENCY_CAP.maxSends,
  },
): Promise<CapResult> {
  const sql = `WITH anchor AS (SELECT MAX(sent_at) AS d FROM campaign_sends),
capped AS (
  SELECT customer_id FROM campaign_sends, anchor
  WHERE sent_at >= anchor.d - INTERVAL ${cap.windowDays} DAY
  GROUP BY customer_id HAVING COUNT(*) >= ${cap.maxSends}
)
SELECT
  (SELECT COUNT(*) FROM customer_360 c JOIN capped USING (customer_id) WHERE ${filterSql} AND ${persuadableSql}) AS excluded,
  (SELECT d FROM anchor) AS anchor`;
  const r = await callMcpTool(wh, "run_sql", { sql });
  if (r.isError) throw new Error(r.text);
  const row = (JSON.parse(r.text).rows as { excluded: number; anchor: string }[])[0];
  if (!row) throw new Error("frequency cap query returned no rows");
  return {
    ruleId: cap.ruleId,
    windowDays: cap.windowDays,
    maxSends: cap.maxSends,
    excluded: Number(row.excluded),
    anchor: String(row.anchor),
  };
}
