/**
 * One-shot MCP client for manual verification:
 *   pnpm mcp:call list_tables
 *   pnpm mcp:call get_schema customers
 *   pnpm mcp:call run_sql "select count(*) from customers"
 *
 * Spawns the stdio server, calls one tool, prints the result, exits.
 */
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { REPO_ROOT } from "../shared/env.js";

const [, , tool, ...rest] = process.argv;
if (!tool) {
  console.error("usage: pnpm mcp:call <list_tables|get_schema|run_sql> [args]");
  process.exit(1);
}

const raw = rest.join(" ").trim();
const args: Record<string, unknown> =
  tool === "run_sql"
    ? { sql: raw }
    : tool === "get_schema" && rest[0]
      ? { table: rest[0] }
      : raw.startsWith("{")
        ? (JSON.parse(raw) as Record<string, unknown>) // run_metric / design_holdout take JSON args
        : {};

const transport = new StdioClientTransport({
  command: resolve(REPO_ROOT, "node_modules/.bin/tsx"),
  args: [resolve(REPO_ROOT, "packages/core/src/mcp-warehouse/server.ts")],
});

const client = new Client({ name: "mcp-call", version: "0.1.0" });
await client.connect(transport);
const result = (await client.callTool({ name: tool, arguments: args })) as {
  isError?: boolean;
  content: { type: string; text?: string }[];
};
for (const part of result.content) if (part.type === "text") console.log(part.text);
await client.close();
process.exit(result.isError ? 2 : 0);
