import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { PolicySnapshot } from "@lift/protocol";
import { callMcpTool } from "../harness/mcp-client.js";

/**
 * Server-side posterior learning — the "learn" half of the split whose
 * "select" half runs on the device (@lift/sdk policy.ts).
 *
 * campaign_sends already holds a two-slot (A/B) history per campaign; joining
 * customer_360 gives outcomes per value tier. Beta(1,1) prior + observed
 * conversions -> Beta(1 + conv, 1 + (n - conv)) per (tier, slot). The bundle
 * ships these under segment keys matching "attr:value_tier" resolution.
 *
 * Goes through the MCP run_sql surface like every other agent-side read: the
 * delivery compiler gets no more access than the agents have.
 */
export async function learnPosteriors(wh: Client, campaignId: string): Promise<PolicySnapshot> {
  const sql = `SELECT value_tier, variant, COUNT(*) AS n, SUM(converted) AS conv
FROM campaign_sends JOIN customer_360 USING (customer_id)
WHERE treatment = 1 AND campaign_id = '${campaignId.replace(/'/g, "''")}'
GROUP BY value_tier, variant ORDER BY value_tier, variant`;
  const r = await callMcpTool(wh, "run_sql", { sql });
  if (r.isError) throw new Error(r.text);
  const rows = (JSON.parse(r.text).rows as { value_tier: string; variant: string; n: number; conv: number }[]) ?? [];

  const segments: PolicySnapshot["segments"] = {};
  for (const row of rows) {
    const tier = (segments[row.value_tier] ??= {});
    tier[row.variant] = { alpha: 1 + Number(row.conv), beta: 1 + (Number(row.n) - Number(row.conv)) };
  }
  return { segments };
}
