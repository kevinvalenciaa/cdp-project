import { describe, expect, it } from "vitest";
import { assertReadOnly } from "./warehouse.js";

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
