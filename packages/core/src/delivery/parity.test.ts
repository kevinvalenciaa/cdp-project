import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { matchPredicate, type Attrs } from "@lift/sdk";
import { AUDIENCE } from "../activation/audience.js";
import { predicateToSql, type Predicate } from "../activation/predicate.js";
import { Db } from "../shared/db.js";
import { config } from "../shared/env.js";

/**
 * THE differential test of the predicate contract.
 *
 * One predicate, two independent evaluators: predicateToSql() run by DuckDB's
 * engine on the server, and the SDK's hand-written matchPredicate() on the
 * device. This test runs BOTH over the real customer_360 rows and asserts
 * identical membership — not a function equalling itself, but two
 * implementations forced to agree on real data. If they ever diverge, the
 * device would show messages to people the server never targeted (or vice
 * versa), which is the exact class of bug a delivery SDK must not have.
 */

const HAS_WAREHOUSE = existsSync(config.duckdbPath);

const maybe = HAS_WAREHOUSE ? describe : describe.skip;

/** DuckDB row -> SDK attrs: BigInt counts become numbers; null never occurs in customer_360. */
function toAttrs(row: Record<string, unknown>): Attrs {
  const out: Attrs = {};
  for (const [k, v] of Object.entries(row)) {
    if (typeof v === "bigint") out[k] = Number(v);
    else if (typeof v === "boolean" || typeof v === "number" || typeof v === "string") out[k] = v;
  }
  return out;
}

maybe("predicate parity: SQL engine vs device matcher over real customer_360 rows", () => {
  async function bothSides(p: Predicate): Promise<{ sqlIds: number[]; tsIds: number[]; total: number }> {
    const db = await Db.open(config.duckdbPath);
    try {
      const sqlRows = await db.all<{ customer_id: bigint | number }>(
        `SELECT customer_id FROM customer_360 WHERE ${predicateToSql(p)} ORDER BY customer_id`,
      );
      const allRows = await db.all<Record<string, unknown>>(`SELECT * FROM customer_360 ORDER BY customer_id`);
      const tsIds = allRows.filter((r) => matchPredicate(p, toAttrs(r)).matched).map((r) => Number(r.customer_id));
      return { sqlIds: sqlRows.map((r) => Number(r.customer_id)), tsIds, total: allRows.length };
    } finally {
      db.close();
    }
  }

  for (const [key, def] of Object.entries(AUDIENCE)) {
    it(`${key}: filter AND persuadableFilter agree exactly`, async () => {
      const combined: Predicate = { all: [def.filter, def.persuadableFilter] };
      const { sqlIds, tsIds, total } = await bothSides(combined);
      expect(tsIds).toEqual(sqlIds);
      // Non-trivial: the predicate must actually partition the population,
      // otherwise this test proves nothing.
      expect(sqlIds.length).toBeGreaterThan(0);
      expect(sqlIds.length).toBeLessThan(total);
    });
  }

  it("nested any/not with an in-list agrees exactly", async () => {
    const p: Predicate = {
      all: [
        { any: [{ column: "first_category", op: "in", value: ["Outerwear", "Workwear"] }, { column: "n_orders", op: ">=", value: 5 }] },
        { not: { column: "is_churn_risk", op: "=", value: true } },
        { column: "avg_order_value", op: ">", value: 60 },
      ],
    };
    const { sqlIds, tsIds, total } = await bothSides(p);
    expect(tsIds).toEqual(sqlIds);
    expect(sqlIds.length).toBeGreaterThan(0);
    expect(sqlIds.length).toBeLessThan(total);
  });

  it("string equality with quoting agrees exactly", async () => {
    const p: Predicate = {
      all: [{ column: "region", op: "=", value: "West" }, { column: "value_tier", op: "in", value: ["vip", "high"] }],
    };
    const { sqlIds, tsIds } = await bothSides(p);
    expect(tsIds).toEqual(sqlIds);
    expect(sqlIds.length).toBeGreaterThan(0);
  });
});
