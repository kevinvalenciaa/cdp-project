import { describe, expect, it } from "vitest";
import { emptyProvenance, queryFingerprint } from "./provenance.js";

describe("queryFingerprint", () => {
  it("is stable for fixed inputs", () => {
    const a = queryFingerprint("SELECT 1", "abc123");
    const b = queryFingerprint("SELECT 1", "abc123");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
  });

  it("differs when the SQL changes (same result rows)", () => {
    expect(queryFingerprint("SELECT 1 AS a", "samehash")).not.toBe(queryFingerprint("SELECT 1 AS a WHERE 1=1", "samehash"));
  });

  it("differs when the result hash changes (same SQL)", () => {
    expect(queryFingerprint("SELECT 1", "hash-one")).not.toBe(queryFingerprint("SELECT 1", "hash-two"));
  });
});

describe("emptyProvenance", () => {
  it("has no queries and no stats call", () => {
    expect(emptyProvenance()).toEqual({ queries: [], stats: null });
  });
});
