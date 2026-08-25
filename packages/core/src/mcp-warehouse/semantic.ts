import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import type { QueryResult, Warehouse } from "./warehouse.js";

interface MetricDef {
  description?: string;
  table: string;
  sql: string;
}
interface DimDef {
  table: string;
  sql: string;
}
interface Catalog {
  metrics: Record<string, MetricDef>;
  dimensions: Record<string, DimDef>;
  filterable: Record<string, string[]>;
  /** Alias -> canonical metric name (resolution only - never widens the governed surface). */
  synonyms?: Record<string, string>;
  /** Documentary FK graph; runMetric stays single-table by design (see metrics.yaml). */
  relationships?: unknown;
}

export interface Filter {
  column: string;
  op: string;
  value: string | number | boolean | (string | number)[];
}

/** Thrown when a request falls outside the governed semantic layer. */
export class OutOfScopeError extends Error {}

const here = dirname(fileURLToPath(import.meta.url));
const catalog = parseYaml(readFileSync(resolve(here, "semantic/metrics.yaml"), "utf8")) as Catalog;

const ALLOWED_OPS = new Set(["=", "!=", "<", ">", "<=", ">=", "in"]);

function fmtValue(v: string | number | boolean): string {
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return `'${String(v).replace(/'/g, "''")}'`;
}

function buildWhere(table: string, filters: Filter[] | undefined): string {
  if (!filters || filters.length === 0) return "";
  const allowed = new Set(catalog.filterable[table] ?? []);
  const clauses = filters.map((f) => {
    if (!allowed.has(f.column)) {
      throw new OutOfScopeError(
        `filter column '${f.column}' is not allowed on ${table}. Allowed: ${[...allowed].join(", ")}`,
      );
    }
    if (!ALLOWED_OPS.has(f.op)) throw new OutOfScopeError(`operator '${f.op}' is not permitted`);
    if (f.op === "in") {
      const arr = Array.isArray(f.value) ? f.value : [f.value];
      return `${f.column} IN (${arr.map(fmtValue).join(", ")})`;
    }
    if (Array.isArray(f.value)) throw new OutOfScopeError(`operator '${f.op}' does not take a list`);
    return `${f.column} ${f.op} ${fmtValue(f.value)}`;
  });
  return `WHERE ${clauses.join(" AND ")}`;
}

export function metricCatalog(): { metrics: string[]; dimensions: string[] } {
  return { metrics: Object.keys(catalog.metrics), dimensions: Object.keys(catalog.dimensions) };
}

export async function runMetric(
  wh: Warehouse,
  metric: string,
  groupBy?: string[],
  filters?: Filter[],
): Promise<QueryResult & { metric: string; sql: string }> {
  // Resolve aliases first ("revenue" -> total_revenue): synonyms absorb naming drift
  // without widening the surface - an unknown name still errors out-of-scope.
  const canonical = catalog.metrics[metric] ? metric : (catalog.synonyms?.[metric] ?? metric);
  const m = catalog.metrics[canonical];
  if (!m) {
    const aliases = Object.keys(catalog.synonyms ?? {});
    throw new OutOfScopeError(
      `metric '${metric}' is not defined in the semantic layer. Available: ${Object.keys(catalog.metrics).join(", ")}` +
        (aliases.length ? `. Aliases: ${aliases.join(", ")}` : ""),
    );
  }
  metric = canonical;
  const dims = (groupBy ?? []).map((d) => {
    const dd = catalog.dimensions[d];
    if (!dd) {
      throw new OutOfScopeError(`dimension '${d}' is not defined. Available: ${Object.keys(catalog.dimensions).join(", ")}`);
    }
    if (dd.table !== m.table) {
      throw new OutOfScopeError(`dimension '${d}' (${dd.table}) is not on the same table as metric '${metric}' (${m.table})`);
    }
    return { name: d, ...dd };
  });
  const where = buildWhere(m.table, filters);
  const selectParts = [...dims.map((d) => `${d.sql} AS ${d.name}`), `${m.sql} AS value`];
  const groupClause = dims.length ? `GROUP BY ${dims.map((d) => d.sql).join(", ")} ORDER BY value DESC` : "";
  const sql = `SELECT ${selectParts.join(", ")} FROM ${m.table} ${where} ${groupClause} LIMIT 500`.replace(/\s+/g, " ").trim();
  const res = await wh.runSql(sql);
  return { metric, sql, ...res };
}

export async function designHoldout(
  wh: Warehouse,
  filters: Filter[],
  holdoutFraction = 0.2,
): Promise<Record<string, unknown>> {
  if (holdoutFraction <= 0 || holdoutFraction >= 1) throw new OutOfScopeError("holdoutFraction must be in (0,1)");
  const where = buildWhere("customer_360", filters);
  const ctrlPct = Math.round(holdoutFraction * 100);
  const sql = `
    WITH seg AS (SELECT customer_id, total_revenue, n_orders, avg_order_value FROM customer_360 ${where}),
    arm AS (SELECT *, CASE WHEN (hash(customer_id) % 100) < ${ctrlPct} THEN 'control' ELSE 'treatment' END AS arm FROM seg)
    SELECT arm, COUNT(*) AS n, AVG(total_revenue) AS avg_ltv, AVG(n_orders) AS avg_orders, AVG(avg_order_value) AS avg_aov
    FROM arm GROUP BY arm ORDER BY arm`.replace(/\s+/g, " ").trim();
  const res = await wh.runSql(sql);
  const rows = res.rows as Record<string, number | string>[];
  const ctrl = rows.find((r) => r.arm === "control");
  const treat = rows.find((r) => r.arm === "treatment");
  let balanceDiff: number | null = null;
  if (ctrl && treat) {
    const a = Number(treat.avg_ltv);
    const b = Number(ctrl.avg_ltv);
    balanceDiff = (a + b) / 2 > 0 ? Math.abs(a - b) / ((a + b) / 2) : 0;
  }
  return {
    method: "deterministic hash split on customer_id; covariate balance checked on avg LTV",
    holdoutFraction,
    arms: rows,
    balanceDiff,
    balanced: balanceDiff !== null && balanceDiff < 0.1,
    sql,
  };
}
