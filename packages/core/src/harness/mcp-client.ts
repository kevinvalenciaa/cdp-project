import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { REPO_ROOT } from "../shared/env.js";
import type { ToolDef } from "../shared/types.js";

export async function connectWarehouse(): Promise<Client> {
  const transport = new StdioClientTransport({
    command: resolve(REPO_ROOT, "node_modules/.bin/tsx"),
    args: [resolve(REPO_ROOT, "packages/core/src/mcp-warehouse/server.ts")],
  });
  const client = new Client({ name: "harness-warehouse", version: "0.1.0" });
  await client.connect(transport);
  return client;
}

export async function connectStats(): Promise<Client> {
  const transport = new StdioClientTransport({
    command: "uv",
    args: ["run", "stats-server"],
    cwd: resolve(REPO_ROOT, "services/stats"),
  });
  const client = new Client({ name: "harness-stats", version: "0.1.0" });
  await client.connect(transport);
  return client;
}

/** List tools from each MCP server and build the Anthropic tool list + a routing map. */
export async function bridgeTools(clients: Client[]): Promise<{ tools: ToolDef[]; route: Map<string, Client> }> {
  const tools: ToolDef[] = [];
  const route = new Map<string, Client>();
  for (const client of clients) {
    const list = await client.listTools();
    for (const t of list.tools) {
      const schema = (t.inputSchema as Record<string, unknown>) ?? { type: "object", properties: {} };
      tools.push({ name: t.name, description: t.description ?? "", input_schema: schema });
      route.set(t.name, client);
    }
  }
  return { tools, route };
}

export async function callMcpTool(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<{ text: string; isError: boolean }> {
  const res = await client.callTool({ name, arguments: args });
  const text = ((res.content as { type: string; text?: string }[]) ?? [])
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("\n");
  return { text, isError: Boolean(res.isError) };
}
