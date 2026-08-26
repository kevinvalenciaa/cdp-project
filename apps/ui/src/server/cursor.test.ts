import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT, decodeCursor, encodeCursor, paginate, parsePageLimit } from "./cursor";
import { boundedLimit } from "./investigations/repository";

describe("parsePageLimit", () => {
  it("falls back to the default for a missing or unparseable limit", () => {
    // The regression: `Number(param ?? 50)` only guarded a *missing* parameter,
    // so ?limit=abc produced NaN, Math.min/max propagated it, and the local
    // repository's slice(0, NaN) returned an empty array - a 200 with an empty
    // workspace - while Postgres raised "invalid input syntax for type bigint".
    expect(parsePageLimit(null)).toBe(DEFAULT_PAGE_LIMIT);
    expect(parsePageLimit("")).toBe(DEFAULT_PAGE_LIMIT);
    expect(parsePageLimit("abc")).toBe(DEFAULT_PAGE_LIMIT);
    expect(parsePageLimit("NaN")).toBe(DEFAULT_PAGE_LIMIT);
    expect(parsePageLimit("Infinity")).toBe(DEFAULT_PAGE_LIMIT);
  });

  it("clamps to the supported range", () => {
    expect(parsePageLimit("0")).toBe(1);
    expect(parsePageLimit("-5")).toBe(1);
    expect(parsePageLimit("7")).toBe(7);
    expect(parsePageLimit("7.9")).toBe(7);
    expect(parsePageLimit("1000")).toBe(MAX_PAGE_LIMIT);
  });
});

describe("boundedLimit", () => {
  it("leaves room for the pagination sentinel row", () => {
    // Clamping to exactly pageMax swallowed the extra row paginate() requests to
    // detect a next page, so at limit === pageMax nextCursor was permanently
    // null. That happened in Postgres only; the local repository did not clamp,
    // so demo mode paged correctly and hid it.
    expect(boundedLimit(MAX_PAGE_LIMIT + 1, MAX_PAGE_LIMIT)).toBe(MAX_PAGE_LIMIT + 1);
    expect(boundedLimit(500, 100)).toBe(101);
    expect(boundedLimit(undefined, 100)).toBe(100);
    expect(boundedLimit(Number.NaN, 100)).toBe(100);
    expect(boundedLimit(0, 100)).toBe(1);
  });
});

describe("paginate", () => {
  it("emits a cursor only when a further page exists", async () => {
    const rows = Array.from({ length: 5 }, (_, index) => ({ id: `row-${index}` }));
    const page = await paginate(
      3,
      async (take) => rows.slice(0, take),
      (item) => ({ id: item.id }),
    );
    expect(page.items).toHaveLength(3);
    expect(page.nextCursor).not.toBeNull();
    expect(decodeCursor(page.nextCursor)).toEqual({ id: "row-2" });
  });

  it("emits no cursor on the final page", async () => {
    const rows = [{ id: "only" }];
    const page = await paginate(
      3,
      async (take) => rows.slice(0, take),
      (item) => ({ id: item.id }),
    );
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBeNull();
  });

  it("requests one row beyond the page so the sentinel is observable", async () => {
    const seen: number[] = [];
    await paginate(
      10,
      async (take) => {
        seen.push(take);
        return [];
      },
      (item) => item,
    );
    expect(seen).toEqual([11]);
  });

  it("round-trips cursor payloads", () => {
    const value = { impactMonthly: 12_345.67, key: "SECOND_PURCHASE_SMS" };
    expect(decodeCursor(encodeCursor(value))).toEqual(value);
    expect(decodeCursor("not-base64-json")).toBeNull();
    expect(decodeCursor(null)).toBeNull();
  });
});
