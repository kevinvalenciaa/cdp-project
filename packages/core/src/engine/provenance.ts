import { createHash } from "node:crypto";

/** One executed query: the SQL, the warehouse's result signature, and a combined fingerprint. */
export interface QueryProvenance {
  sql: string;
  resultHash: string; // warehouse-side sha256 of the returned rows (result signature)
  fingerprint: string; // sha256(sql + resultHash) - pins question AND answer together
}

/** The stats-MCP call that produced the verdict (null when no stats tool ran). */
export interface StatsProvenance {
  tool: string;
  args: Record<string, unknown>;
  verdict: string;
}

export interface Provenance {
  queries: QueryProvenance[];
  stats: StatsProvenance | null;
}

/**
 * sha256 over sql + the warehouse resultHash, first 16 hex. The warehouse hash covers rows
 * only, so two different queries returning identical rows would collide; folding the SQL in
 * makes the fingerprint identify the (question, answer) pair - the unit of provenance.
 */
export function queryFingerprint(sql: string, resultHash: string): string {
  return createHash("sha256").update(`${sql}\n${resultHash}`).digest("hex").slice(0, 16);
}

export function emptyProvenance(): Provenance {
  return { queries: [], stats: null };
}
