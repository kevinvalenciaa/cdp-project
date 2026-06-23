import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { callMcpTool } from "../harness/mcp-client.js";

async function rows(wh: Client, sql: string): Promise<Record<string, unknown>[]> {
  const r = await callMcpTool(wh, "run_sql", { sql });
  if (r.isError) throw new Error(r.text);
  return (JSON.parse(r.text).rows as Record<string, unknown>[]) ?? [];
}

/** Map each verified opportunity to a concrete, activatable audience definition. */
const AUDIENCE: Record<string, { label: string; filter: string; persuadableFilter: string; channel: "sms" | "email" | "push" }> = {
  SECOND_PURCHASE_SMS: { label: "One-time buyers", filter: "is_one_time_buyer = TRUE", persuadableFilter: "sms_responder = TRUE", channel: "sms" },
  CROSS_CATEGORY_SMS: { label: "First-time single-category buyers", filter: "is_one_time_buyer = TRUE AND categories_purchased = 1", persuadableFilter: "sms_responder = TRUE", channel: "sms" },
  SPRING_DROP_CREATIVE: { label: "Drop-lookalike (Outerwear/Workwear)", filter: "first_category IN ('Outerwear','Workwear')", persuadableFilter: "email_responder = TRUE", channel: "email" },
  SPRING_EVERGREEN_CREATIVE: { label: "Drop-lookalike (Outerwear/Workwear)", filter: "first_category IN ('Outerwear','Workwear')", persuadableFilter: "email_responder = TRUE", channel: "email" },
};

export interface AudienceDef {
  label: string;
  channel: "sms" | "email" | "push";
  filter: string;
  reach: number;
  persuadableReach: number;
  persuadableFilter: string;
  sampleMembers: number[];
}

export async function compileAudience(wh: Client, opportunityKey: string): Promise<AudienceDef> {
  const a = AUDIENCE[opportunityKey] ?? {
    label: "Eligible customers",
    filter: "n_orders >= 1",
    persuadableFilter: "email_responder = TRUE",
    channel: "email" as const,
  };
  const reach = Number((await rows(wh, `SELECT COUNT(*) AS c FROM customer_360 WHERE ${a.filter}`))[0]?.c);
  const persuadableReach = Number(
    (await rows(wh, `SELECT COUNT(*) AS c FROM customer_360 WHERE ${a.filter} AND ${a.persuadableFilter}`))[0]?.c,
  );
  const members = await rows(
    wh,
    `SELECT customer_id FROM customer_360 WHERE ${a.filter} AND ${a.persuadableFilter} ORDER BY total_revenue DESC LIMIT 8`,
  );
  return {
    label: a.label,
    channel: a.channel,
    filter: a.filter,
    reach,
    persuadableReach,
    persuadableFilter: a.persuadableFilter,
    sampleMembers: members.map((m) => Number(m.customer_id)),
  };
}
