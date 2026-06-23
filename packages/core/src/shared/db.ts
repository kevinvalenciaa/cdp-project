import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";

/** SQL value formatter for batched INSERTs. Dates/timestamps are passed as strings. */
function sqlValue(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return `'${String(v).replace(/'/g, "''")}'`;
}

/** Coerce DuckDB scalar (which may be bigint) to a JS number. */
export function num(v: unknown): number {
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  return Number.NaN;
}

export class Db {
  private constructor(private readonly conn: DuckDBConnection) {}

  static async open(path: string): Promise<Db> {
    const instance = await DuckDBInstance.create(path);
    const conn = await instance.connect();
    return new Db(conn);
  }

  /** In-memory database (handy for tests). */
  static async memory(): Promise<Db> {
    const instance = await DuckDBInstance.create(":memory:");
    const conn = await instance.connect();
    return new Db(conn);
  }

  async run(sql: string): Promise<void> {
    await this.conn.run(sql);
  }

  async all<T = Record<string, unknown>>(sql: string): Promise<T[]> {
    const reader = await this.conn.runAndReadAll(sql);
    return reader.getRowObjects() as T[];
  }

  /** First row, or undefined. */
  async one<T = Record<string, unknown>>(sql: string): Promise<T | undefined> {
    const rows = await this.all<T>(sql);
    return rows[0];
  }

  /** Single scalar from the first row/column. */
  async scalar(sql: string): Promise<unknown> {
    const reader = await this.conn.runAndReadAll(sql);
    const rows = reader.getRows();
    return rows[0]?.[0];
  }

  /** Batched multi-row INSERT. Dates/timestamps must be passed as strings. */
  async insertRows(table: string, columns: string[], rows: unknown[][], batchSize = 1000): Promise<void> {
    if (rows.length === 0) return;
    const colList = columns.join(", ");
    for (let i = 0; i < rows.length; i += batchSize) {
      const slice = rows.slice(i, i + batchSize);
      const values = slice.map((r) => `(${r.map(sqlValue).join(", ")})`).join(",\n");
      await this.conn.run(`INSERT INTO ${table} (${colList}) VALUES\n${values};`);
    }
  }

  close(): void {
    this.conn.closeSync();
  }
}
