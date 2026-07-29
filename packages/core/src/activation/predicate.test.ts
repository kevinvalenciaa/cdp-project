import { describe, expect, it } from "vitest";
import { predicateToSql, type Predicate } from "./predicate.js";

describe("predicateToSql", () => {
  it("compiles boolean and numeric leaves with semantic-layer quoting", () => {
    expect(predicateToSql({ column: "is_one_time_buyer", op: "=", value: true })).toBe("is_one_time_buyer = TRUE");
    expect(predicateToSql({ column: "n_orders", op: ">=", value: 1 })).toBe("n_orders >= 1");
  });

  it("compiles in-lists and escapes string quotes", () => {
    expect(predicateToSql({ column: "first_category", op: "in", value: ["Outerwear", "Workwear"] })).toBe(
      "first_category IN ('Outerwear', 'Workwear')",
    );
    expect(predicateToSql({ column: "region", op: "=", value: "cote d'azur" })).toBe("region = 'cote d''azur'");
  });

  it("compiles nested all/any/not with parentheses", () => {
    const p: Predicate = {
      all: [
        { column: "is_one_time_buyer", op: "=", value: true },
        { any: [{ column: "sms_responder", op: "=", value: true }, { column: "email_responder", op: "=", value: true }] },
        { not: { column: "is_churn_risk", op: "=", value: true } },
      ],
    };
    expect(predicateToSql(p)).toBe(
      "(is_one_time_buyer = TRUE AND (sms_responder = TRUE OR email_responder = TRUE) AND (NOT is_churn_risk = TRUE))",
    );
  });

  it("rejects list values on non-in operators", () => {
    expect(() => predicateToSql({ column: "n_orders", op: "=", value: [1, 2] })).toThrow(/does not take a list/);
  });

  it("compiles empty groups to constants (all -> TRUE, any -> FALSE)", () => {
    expect(predicateToSql({ all: [] })).toBe("TRUE");
    expect(predicateToSql({ any: [] })).toBe("FALSE");
  });
});
