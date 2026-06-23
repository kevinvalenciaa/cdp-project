/**
 * Read-only Warehouse MCP server (Phase 0 tools).
 *
 * Tools: list_tables, get_schema, run_sql.
 * Security: DuckDB opened READ_ONLY, single-statement SELECT/WITH only, query timeout,
 * every call appended to an audit log, results carry a sha256 "signature".
 *
 * Transport: stdio (the standard local transport; a client spawns this process).
 * Run directly: `pnpm mcp:warehouse`. Call a tool one-shot: `pnpm mcp:call <tool> [args]`.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { Warehouse } from "./warehouse.js";
import { audit } from "./audit.js";
import { designHoldout, metricCatalog, runMetric, type Filter } from "./semantic.js";

const filterSchema = z.object({ column: z.string(), op: z.string(), value: z.any() });

const wh = await Warehouse.open();
const server = new McpServer({ name: "lift-warehouse", version: "0.1.0" });

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}
function fail(message: string) {
  return { isError: true, content: [{ type: "text" as const, text: `ERROR: ${message}` }] };
}

server.registerTool(
  "list_tables",
  {
    title: "List tables",
    description: "List all tables/views in the warehouse with row counts and descriptions.",
    inputSchema: {},
  },
  async () => {
    const tables = await wh.listTables();
    audit({ tool: "list_tables", status: "ok", n: tables.length });
    return ok(tables);
  },
);

server.registerTool(
  "get_schema",
  {
    title: "Get schema",
    description: "Get column names and types for a table (or all tables if omitted).",
    inputSchema: { table: z.string().optional().describe("Table name; omit for all tables.") },
  },
  async ({ table }) => {
    const schema = await wh.getSchema(table);
    audit({ tool: "get_schema", status: "ok", table: table ?? "*" });
    return ok(schema);
  },
);

server.registerTool(
  "run_sql",
  {
    title: "Run SQL",
    description:
      "Run a single read-only SELECT/WITH query against the warehouse. Returns up to 1000 rows plus a result signature. Write/DDL is rejected.",
    inputSchema: { sql: z.string().describe("A single SELECT or WITH query.") },
  },
  async ({ sql }) => {
    try {
      const res = await wh.runSql(sql);
      audit({ tool: "run_sql", status: "ok", sql, rowCount: res.rowCount, truncated: res.truncated, resultHash: res.resultHash, durationMs: res.durationMs });
      return ok(res);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      audit({ tool: "run_sql", status: "error", sql, error: message });
      return fail(message);
    }
  },
);

server.registerTool(
  "run_metric",
  {
    title: "Run metric (semantic layer)",
    description: `Resolve a GOVERNED metric from the semantic layer (errors out-of-scope; never guesses). Prefer this over run_sql for KPIs. Metrics: ${metricCatalog().metrics.join(", ")}. Dimensions: ${metricCatalog().dimensions.join(", ")}.`,
    inputSchema: {
      metric: z.string().describe("A metric name from the catalog."),
      groupBy: z.array(z.string()).optional().describe("Dimension names to group by."),
      filters: z.array(filterSchema).optional().describe("Filters: {column, op, value}."),
    },
  },
  async ({ metric, groupBy, filters }) => {
    try {
      const res = await runMetric(wh, metric, groupBy, filters as Filter[] | undefined);
      audit({ tool: "run_metric", status: "ok", metric, groupBy, sql: res.sql, rowCount: res.rowCount, resultHash: res.resultHash });
      return ok(res);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      audit({ tool: "run_metric", status: "error", metric, error: message });
      return fail(message);
    }
  },
);

server.registerTool(
  "design_holdout",
  {
    title: "Design holdout",
    description:
      "Construct a matched treatment/control split for a customer_360 segment (deterministic hash split + covariate-balance check). Use to measure incremental lift where no holdout was pre-assigned.",
    inputSchema: {
      filters: z.array(filterSchema).describe("Segment definition: filters on customer_360."),
      holdoutFraction: z.number().optional().describe("Control fraction in (0,1); default 0.2."),
    },
  },
  async ({ filters, holdoutFraction }) => {
    try {
      const res = await designHoldout(wh, filters as Filter[], holdoutFraction ?? 0.2);
      audit({ tool: "design_holdout", status: "ok", filters, balanced: res.balanced });
      return ok(res);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      audit({ tool: "design_holdout", status: "error", error: message });
      return fail(message);
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
// stderr so it doesn't corrupt the stdio JSON-RPC channel
console.error("[mcp-warehouse] ready (stdio)");
