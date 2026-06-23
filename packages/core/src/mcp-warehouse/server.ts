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

const transport = new StdioServerTransport();
await server.connect(transport);
// stderr so it doesn't corrupt the stdio JSON-RPC channel
console.error("[mcp-warehouse] ready (stdio)");
