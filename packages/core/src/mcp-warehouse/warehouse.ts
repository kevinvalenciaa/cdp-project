import { createHash } from "node:crypto";
import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";
import { config } from "../shared/env.js";

const MAX_ROWS = 1000;

const TABLE_DESCRIPTIONS: Record<string, string> = {
  customers: "Customer master (region, value_tier, channel responsiveness, signup).",
  products: "Product catalog (category, price, is_premium, never_discount, collection, is_product_drop, launch_date).",
  orders: "Order headers (customer_id, order_date, revenue, channel).",
  order_items: "Line items (order_id, product_id, quantity, unit_price).",
  campaigns: "Campaigns (channel, type, creative_style, start_date, target).",
  campaign_sends: "Campaign sends with treatment/holdout, variant, converted, revenue (the experiments).",
  customer_360: "Derived per-customer view: RFM-ish features, n_orders, categories_purchased, is_one_time_buyer, is_churn_risk.",
};

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  truncated: boolean;
  resultHash: string;
  durationMs: number;
}

/** Reject anything that is not a single read-only SELECT/WITH statement. */
export function assertReadOnly(sql: string): string {
  const trimmed = sql.trim().replace(/;\s*$/, "");
  if (trimmed.includes(";")) throw new Error("Only a single statement is allowed (no ';').");
  if (!/^(select|with)\b/i.test(trimmed)) {
    throw new Error("Read-only warehouse: only SELECT / WITH queries are permitted.");
  }
  const forbidden = /\b(insert|update|delete|drop|alter|attach|copy|pragma|install|load|export|create|truncate|replace)\b/i;
  if (forbidden.test(trimmed)) {
    throw new Error("Read-only warehouse: write/DDL keywords are not permitted.");
  }
  return trimmed;
}

/** Normalize DuckDB scalar values to JSON-friendly forms. */
function normalize(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.days === "number") return new Date(o.days * 86_400_000).toISOString().slice(0, 10);
    if (typeof o.micros === "bigint" || typeof o.micros === "number") {
      return new Date(Number(o.micros) / 1000).toISOString().replace("T", " ").slice(0, 19);
    }
  }
  return v;
}

export class Warehouse {
  private constructor(
    private readonly conn: DuckDBConnection,
    private readonly timeoutMs: number,
  ) {}

  /**
   * STRICTLY read-only: least privilege enforced at the engine level, not the prompt level.
   * No fallback — if the READ_ONLY open fails we fail loudly rather than silently reopening
   * with write access (a silent fallback would defeat the whole guarantee, and READ_ONLY
   * cannot create a missing file, which is exactly right: seeding has its own write path).
   */
  static async open(opts: { path?: string; timeoutMs?: number } = {}): Promise<Warehouse> {
    const path = opts.path ?? config.duckdbPath;
    let instance: DuckDBInstance;
    try {
      instance = await DuckDBInstance.create(path, { access_mode: "READ_ONLY" });
    } catch (e) {
      throw new Error(`Warehouse could not be opened READ_ONLY at ${path} (did you run \`pnpm seed\`?): ${String(e)}`);
    }
    const conn = await instance.connect();
    return new Warehouse(conn, opts.timeoutMs ?? config.queryTimeoutMs);
  }

  async listTables(): Promise<{ name: string; rows: number; description: string }[]> {
    const reader = await this.conn.runAndReadAll(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='main' ORDER BY table_name",
    );
    const names = reader.getRowObjects().map((r) => String((r as Record<string, unknown>).table_name));
    const out: { name: string; rows: number; description: string }[] = [];
    for (const name of names) {
      let rows = 0;
      try {
        const c = await this.conn.runAndReadAll(`SELECT count(*) AS c FROM ${name}`);
        rows = Number((c.getRowObjects()[0] as Record<string, unknown>).c);
      } catch {
        rows = -1;
      }
      out.push({ name, rows, description: TABLE_DESCRIPTIONS[name] ?? "" });
    }
    return out;
  }

  async getSchema(table?: string): Promise<Record<string, { column: string; type: string }[]>> {
    const filter = table ? `AND table_name = '${table.replace(/'/g, "''")}'` : "";
    const reader = await this.conn.runAndReadAll(
      `SELECT table_name, column_name, data_type FROM information_schema.columns
       WHERE table_schema='main' ${filter} ORDER BY table_name, ordinal_position`,
    );
    const result: Record<string, { column: string; type: string }[]> = {};
    for (const r of reader.getRowObjects()) {
      const row = r as Record<string, unknown>;
      const t = String(row.table_name);
      (result[t] ??= []).push({ column: String(row.column_name), type: String(row.data_type) });
    }
    return result;
  }

  async runSql(sql: string): Promise<QueryResult> {
    const safe = assertReadOnly(sql);
    const start = Date.now();
    const exec = this.conn.runAndReadAll(safe);
    // The timeout KILLS the query, not just the await: interrupt() aborts execution inside
    // DuckDB, so a runaway query can't keep burning CPU and serializing later calls on this
    // connection. The interrupted exec promise rejects too — swallow it so it can't surface
    // as an unhandled rejection after we've already rejected with the timeout error.
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        try {
          this.conn.interrupt();
        } catch {
          /* best effort */
        }
        reject(new Error(`Query exceeded ${this.timeoutMs}ms timeout (query interrupted).`));
      }, this.timeoutMs);
    });
    exec.catch(() => {});
    let reader: Awaited<typeof exec>;
    try {
      reader = await Promise.race([exec, timeout]);
    } finally {
      clearTimeout(timer);
    }
    const allRows = reader.getRowObjects() as Record<string, unknown>[];
    const columns = allRows[0] ? Object.keys(allRows[0]) : [];
    const truncated = allRows.length > MAX_ROWS;
    const rows = (truncated ? allRows.slice(0, MAX_ROWS) : allRows).map((r) => {
      const o: Record<string, unknown> = {};
      for (const k of Object.keys(r)) o[k] = normalize(r[k]);
      return o;
    });
    const resultHash = createHash("sha256").update(JSON.stringify(rows)).digest("hex").slice(0, 16);
    return { columns, rows, rowCount: allRows.length, truncated, resultHash, durationMs: Date.now() - start };
  }
}
