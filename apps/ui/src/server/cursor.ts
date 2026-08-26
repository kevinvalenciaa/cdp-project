export function encodeCursor(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function decodeCursor(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as unknown;
  } catch {
    return null;
  }
}

export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 100;

/**
 * Parse a ?limit= parameter into a usable page size.
 *
 * `Math.min(Math.max(Number(param ?? 50), 1), 100)` looks like a clamp but is
 * not: `??` only guards a *missing* parameter, so `?limit=abc` produced NaN and
 * Math.min/max propagate NaN rather than clamping it. Downstream, the local
 * repository's `.slice(0, NaN)` returned an empty array - the caller saw an empty
 * workspace with a 200 - and Postgres passed NaN straight into LIMIT and raised
 * "invalid input syntax for type bigint", a 500.
 */
export function parsePageLimit(raw: string | null): number {
  if (raw === null || raw.trim() === "") return DEFAULT_PAGE_LIMIT;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_PAGE_LIMIT;
  return Math.min(Math.max(Math.trunc(parsed), 1), MAX_PAGE_LIMIT);
}

/**
 * Run a keyset-paginated read and derive the next cursor.
 *
 * Fetches one row beyond the page so a following page can be detected, then
 * trims. Repositories must not re-clamp `limit` below what they are asked for:
 * Postgres used to cap it at 100 while the route requested 101, so at limit=100
 * the sentinel row never came back and nextCursor was permanently null -
 * pagination silently stopped after page one in production while demo mode
 * paged correctly.
 */
export async function paginate<T>(
  limit: number,
  fetch: (limit: number) => Promise<T[]>,
  cursorOf: (item: T) => unknown,
): Promise<{ items: T[]; nextCursor: string | null }> {
  const all = await fetch(limit + 1);
  const items = all.slice(0, limit);
  const last = items.at(-1);
  return {
    items,
    nextCursor: all.length > limit && last ? encodeCursor(cursorOf(last)) : null,
  };
}
