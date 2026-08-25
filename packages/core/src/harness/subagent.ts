import type Anthropic from "@anthropic-ai/sdk";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { config } from "../shared/env.js";
import type { CostLedger } from "../shared/cost.js";
import type { ToolDef } from "../shared/types.js";
import { agentLoop } from "./loop.js";
import { bridgeTools, callMcpTool } from "./mcp-client.js";

/**
 * Dynamic investigator subagent. Runs in an ISOLATED thread with one objective and
 * minimal context, does the messy work against the warehouse + stats tools, and returns
 * ONLY a tight summary - chosen over compaction to keep the parent's context dense.
 */
export async function runInvestigator(opts: {
  client: Anthropic;
  model: string;
  objective: string;
  context?: string;
  mcpClients: Client[];
  ledger: CostLedger;
}): Promise<string> {
  const { tools: mcpTools, route } = await bridgeTools(opts.mcpClients);
  const reportTool: ToolDef = {
    name: "report_findings",
    description: "Return your tight summary (2–3 sentences) + key numbers, and stop.",
    input_schema: {
      type: "object",
      properties: { summary: { type: "string" }, key_numbers: { type: "string" } },
      required: ["summary"],
    },
  };

  let report = "";
  const dispatch = async (name: string, input: Record<string, unknown>) => {
    if (name === "report_findings") {
      report = `${String(input.summary ?? "")}${input.key_numbers ? ` | key: ${String(input.key_numbers)}` : ""}`;
      return { text: "reported", stop: true };
    }
    const client = route.get(name);
    if (!client) return { text: `unknown tool ${name}`, isError: true };
    const r = await callMcpTool(client, name, input);
    return { text: r.text, isError: r.isError };
  };

  const system =
    "You are a focused marketing-analytics investigator with ONE objective. Use run_metric " +
    "(preferred) or run_sql for data, and the stats tools for evidence. NEVER assert an incremental " +
    "lift without verify_lift_claim, or a real trend change without assess_seasonality. When done, " +
    "call report_findings with a tight summary + the key numbers. Be brief - return only what the parent needs.";
  const initialUser = `Objective: ${opts.objective}${opts.context ? `\nContext: ${opts.context}` : ""}`;

  const { finalText } = await agentLoop({
    client: opts.client,
    model: opts.model,
    system,
    initialUser,
    tools: [...mcpTools, reportTool],
    dispatch,
    ledger: opts.ledger,
    maxTurns: 8,
    maxTokens: 1200,
    fallbackModel: config.models.fanout,
  });
  // Always return something useful: the explicit report, else the last assistant text.
  return report || finalText || "(investigator produced no findings)";
}
