import type { Predicate, PredicateLeaf } from "@lift/protocol";

/**
 * Deterministic, total predicate evaluation. This is the device half of the
 * predicate contract - the server half is core's predicateToSql(), and
 * delivery/parity.ts holds the two to identical membership over real rows.
 *
 * Total means: no input throws. A missing attribute, a type mismatch, or a
 * string inequality all evaluate to FALSE with the reason recorded in the
 * trail - an eligibility engine must never take the host app down.
 */

export type AttrValue = string | number | boolean;
export type Attrs = Record<string, AttrValue>;

export interface MatchResult {
  matched: boolean;
  /** Human-readable reason trail; populated on failure paths. */
  trail: string[];
}

function leaf(p: PredicateLeaf, attrs: Attrs): MatchResult {
  const actual = attrs[p.column];
  if (actual === undefined) {
    return { matched: false, trail: [`${p.column}: attribute missing`] };
  }
  if (p.op === "in") {
    const arr = Array.isArray(p.value) ? p.value : [p.value];
    const ok = arr.some((v) => v === actual);
    return ok
      ? { matched: true, trail: [] }
      : { matched: false, trail: [`${p.column} in [${arr.join(", ")}]: got ${String(actual)}`] };
  }
  if (Array.isArray(p.value)) {
    return { matched: false, trail: [`${p.column}: operator ${p.op} does not take a list`] };
  }
  if (p.op === "=" || p.op === "!=") {
    const ok = p.op === "=" ? actual === p.value : actual !== p.value;
    return ok
      ? { matched: true, trail: [] }
      : { matched: false, trail: [`${p.column} ${p.op} ${String(p.value)}: got ${String(actual)}`] };
  }
  // Ordered comparison: numbers only. A string/boolean on either side is a
  // deliberate FALSE (with reason), matching SQL's strictness rather than
  // JavaScript's coercion.
  if (typeof actual !== "number" || typeof p.value !== "number") {
    return { matched: false, trail: [`${p.column} ${p.op} ${String(p.value)}: non-numeric comparison`] };
  }
  const ok =
    p.op === "<" ? actual < p.value : p.op === ">" ? actual > p.value : p.op === "<=" ? actual <= p.value : actual >= p.value;
  return ok
    ? { matched: true, trail: [] }
    : { matched: false, trail: [`${p.column} ${p.op} ${p.value}: got ${actual}`] };
}

export function matchPredicate(p: Predicate, attrs: Attrs): MatchResult {
  if ("all" in p) {
    const trail: string[] = [];
    for (const sub of p.all) {
      const r = matchPredicate(sub, attrs);
      if (!r.matched) return { matched: false, trail: r.trail };
      trail.push(...r.trail);
    }
    return { matched: true, trail };
  }
  if ("any" in p) {
    const trail: string[] = [];
    for (const sub of p.any) {
      const r = matchPredicate(sub, attrs);
      if (r.matched) return { matched: true, trail: [] };
      trail.push(...r.trail);
    }
    return { matched: false, trail: trail.length ? [`none matched: ${trail.join(" | ")}`] : ["any: empty"] };
  }
  if ("not" in p) {
    const r = matchPredicate(p.not, attrs);
    return r.matched ? { matched: false, trail: ["negated clause matched"] } : { matched: true, trail: [] };
  }
  return leaf(p, attrs);
}
