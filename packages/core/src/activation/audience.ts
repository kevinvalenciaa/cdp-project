import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { callMcpTool } from "../harness/mcp-client.js";
import { predicateToSql, type Predicate } from "./predicate.js";

async function rows(wh: Client, sql: string): Promise<Record<string, unknown>[]> {
  const r = await callMcpTool(wh, "run_sql", { sql });
  if (r.isError) throw new Error(r.text);
  return (JSON.parse(r.text).rows as Record<string, unknown>[]) ?? [];
}

/**
 * Map each verified opportunity to a concrete, activatable audience definition.
 * Predicates are canonical; SQL is generated from them (predicateToSql), never hand-written -
 * the same predicate ships to the device via the delivery bundle.
 */
export const AUDIENCE: Record<string, { label: string; filter: Predicate; persuadableFilter: Predicate; channel: "sms" | "email" | "push" }> = {
  SECOND_PURCHASE_SMS: {
    label: "One-time buyers",
    filter: { column: "is_one_time_buyer", op: "=", value: true },
    persuadableFilter: { column: "sms_responder", op: "=", value: true },
    channel: "sms",
  },
  CROSS_CATEGORY_SMS: {
    label: "First-time single-category buyers",
    filter: {
      all: [
        { column: "is_one_time_buyer", op: "=", value: true },
        { column: "categories_purchased", op: "=", value: 1 },
      ],
    },
    persuadableFilter: { column: "sms_responder", op: "=", value: true },
    channel: "sms",
  },
  SPRING_DROP_CREATIVE: {
    label: "Drop-lookalike (Outerwear/Workwear)",
    filter: { column: "first_category", op: "in", value: ["Outerwear", "Workwear"] },
    persuadableFilter: { column: "email_responder", op: "=", value: true },
    channel: "email",
  },
  SPRING_EVERGREEN_CREATIVE: {
    label: "Drop-lookalike (Outerwear/Workwear)",
    filter: { column: "first_category", op: "in", value: ["Outerwear", "Workwear"] },
    persuadableFilter: { column: "email_responder", op: "=", value: true },
    channel: "email",
  },
};

const FALLBACK: (typeof AUDIENCE)[string] = {
  label: "Eligible customers",
  filter: { column: "n_orders", op: ">=", value: 1 },
  persuadableFilter: { column: "email_responder", op: "=", value: true },
  channel: "email",
};

export interface AudienceDef {
  label: string;
  channel: "sms" | "email" | "push";
  /** Canonical eligibility - ships to the device via the delivery bundle. */
  filter: Predicate;
  persuadableFilter: Predicate;
  /** Generated SQL (predicateToSql) - for warehouse queries and activation artifacts. */
  filterSql: string;
  persuadableSql: string;
  reach: number;
  persuadableReach: number;
  sampleMembers: number[];
}

export async function compileAudience(wh: Client, opportunityKey: string): Promise<AudienceDef> {
  const a = AUDIENCE[opportunityKey] ?? FALLBACK;
  const filterSql = predicateToSql(a.filter);
  const persuadableSql = predicateToSql(a.persuadableFilter);
  const reach = Number((await rows(wh, `SELECT COUNT(*) AS c FROM customer_360 WHERE ${filterSql}`))[0]?.c);
  const persuadableReach = Number(
    (await rows(wh, `SELECT COUNT(*) AS c FROM customer_360 WHERE ${filterSql} AND ${persuadableSql}`))[0]?.c,
  );
  const members = await rows(
    wh,
    `SELECT customer_id FROM customer_360 WHERE ${filterSql} AND ${persuadableSql} ORDER BY total_revenue DESC LIMIT 8`,
  );
  return {
    label: a.label,
    channel: a.channel,
    filter: a.filter,
    persuadableFilter: a.persuadableFilter,
    filterSql,
    persuadableSql,
    reach,
    persuadableReach,
    sampleMembers: members.map((m) => Number(m.customer_id)),
  };
}
