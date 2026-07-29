/**
 * Audience predicates — the canonical eligibility language.
 *
 * One predicate, two compilations that MUST agree:
 *   - predicateToSql()            -> warehouse WHERE clause (server side)
 *   - @lift/sdk matchPredicate()  -> on-device evaluation (client side)
 * delivery/parity.ts holds both sides to identical membership over real rows.
 *
 * The leaf shape and operator set deliberately match the semantic layer's
 * Filter/ALLOWED_OPS (mcp-warehouse/semantic.ts): the predicate language the
 * agents use to query the warehouse is the language delivery evaluates.
 */

export type PredicateOp = "=" | "!=" | "<" | ">" | "<=" | ">=" | "in";

export interface PredicateLeaf {
  column: string;
  op: PredicateOp;
  value: string | number | boolean | (string | number)[];
}

export type Predicate = PredicateLeaf | { all: Predicate[] } | { any: Predicate[] } | { not: Predicate };

/** Same quoting rules as the semantic layer's fmtValue — numbers raw, booleans TRUE/FALSE, strings ''-escaped. */
function fmtValue(v: string | number | boolean): string {
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return `'${String(v).replace(/'/g, "''")}'`;
}

/** Compile a predicate to a SQL boolean expression (no leading WHERE). */
export function predicateToSql(p: Predicate): string {
  if ("all" in p) {
    if (p.all.length === 0) return "TRUE";
    return `(${p.all.map(predicateToSql).join(" AND ")})`;
  }
  if ("any" in p) {
    if (p.any.length === 0) return "FALSE";
    return `(${p.any.map(predicateToSql).join(" OR ")})`;
  }
  if ("not" in p) return `(NOT ${predicateToSql(p.not)})`;
  if (p.op === "in") {
    const arr = Array.isArray(p.value) ? p.value : [p.value];
    return `${p.column} IN (${arr.map(fmtValue).join(", ")})`;
  }
  if (Array.isArray(p.value)) throw new Error(`operator '${p.op}' does not take a list`);
  return `${p.column} ${p.op} ${fmtValue(p.value)}`;
}
