import { unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Db } from "../shared/db.js";
import { assertReadOnly, Warehouse } from "./warehouse.js";

describe("assertReadOnly", () => {
  it("accepts SELECT and WITH queries", () => {
    expect(assertReadOnly("SELECT 1")).toBe("SELECT 1");
    expect(assertReadOnly("  with x as (select 1) select * from x  ")).toContain("with x");
    expect(assertReadOnly("select count(*) from customers;")).toBe("select count(*) from customers");
  });

  it("rejects write / DDL statements", () => {
    for (const sql of [
      "INSERT INTO customers VALUES (1)",
      "update orders set revenue = 0",
      "delete from orders",
      "drop table customers",
      "create table x (a int)",
      "alter table orders add column z int",
      "copy orders to 'x.csv'",
      "pragma database_list",
    ]) {
      expect(() => assertReadOnly(sql), sql).toThrow();
    }
  });

  it("rejects multiple statements (injection)", () => {
    expect(() => assertReadOnly("select 1; drop table customers")).toThrow();
  });

  it("does not false-positive on legit column names", () => {
    // 'created_at', 'asset' etc. contain DDL substrings but must pass.
    expect(() => assertReadOnly("select created_at, asset_value from t")).not.toThrow();
  });
});

describe("Warehouse (engine-level enforcement)", () => {
  const fixturePath = join(tmpdir(), `wh-test-${process.pid}.duckdb`);

  beforeAll(async () => {
    const db = await Db.open(fixturePath);
    await db.run("CREATE TABLE t (a INTEGER)");
    await db.insertRows("t", ["a"], [[1], [2], [3]]);
    db.close();
  });

  afterAll(() => {
    try {
      unlinkSync(fixturePath);
    } catch {
      /* already gone */
    }
  });

  it("open() FAILS LOUDLY when the file does not exist — no silent read-write reopen", async () => {
    await expect(Warehouse.open({ path: join(tmpdir(), `wh-missing-${process.pid}.duckdb`) })).rejects.toThrow(/READ_ONLY/);
  });

  it("caps result sets at the row limit while reporting the honest rowCount", async () => {
    const wh = await Warehouse.open({ path: fixturePath });
    const res = await wh.runSql("SELECT * FROM range(2500)");
    expect(res.rows.length).toBe(1000);
    expect(res.rowCount).toBe(2500);
    expect(res.truncated).toBe(true);
  });

  it("timeout interrupts the running query (killed, not abandoned)", async () => {
    const wh = await Warehouse.open({ path: fixturePath, timeoutMs: 200 });
    const started = Date.now();
    await expect(
      // Heavy enough to outlive 200ms by orders of magnitude if it were NOT interrupted.
      wh.runSql("SELECT count(*) FROM range(100000000) a, range(200) b"),
    ).rejects.toThrow(/timeout/);
    // Interrupted execution frees the connection promptly: the next query runs fine.
    const after = await wh.runSql("SELECT count(*) AS c FROM t");
    expect(Number(after.rows[0]?.c)).toBe(3);
    expect(Date.now() - started).toBeLessThan(5000);
  });
});
