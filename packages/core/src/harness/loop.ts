import Anthropic from "@anthropic-ai/sdk";
import { config } from "../shared/env.js";
import { CostLedger } from "../shared/cost.js";
import type { ToolDef, TraceEvent } from "../shared/types.js";

const BUFFER_THRESHOLD = 3000; // chars; larger tool results go to the scratchpad

export interface DispatchResult {
  text: string;
  isError?: boolean;
  stop?: boolean;
}

export interface AgentLoopOptions {
  client: Anthropic;
  model: string;
  system: string;
  initialUser: string;
  tools: ToolDef[];
  dispatch: (name: string, input: Record<string, unknown>) => Promise<DispatchResult>;
  ledger: CostLedger;
  maxTurns: number;
  maxTokens?: number;
  fallbackModel?: string; // used if the primary model stays overloaded
  trailing?: () => string | null; // appended at end of context each turn (plan regurgitation)
  onEvent?: (e: Omit<TraceEvent, "t">) => void;
}

function isRetryable(e: unknown): boolean {
  const status = (e as { status?: number })?.status;
  const name = (e as { name?: string })?.name;
  return status === 429 || status === 500 || status === 503 || status === 529 || name === "APIConnectionError";
}

/** messages.create with exponential backoff; falls back to a secondary model if the
 *  primary stays overloaded. Resilience for long unattended runs. */
async function callModel(
  client: Anthropic,
  params: Anthropic.MessageCreateParamsNonStreaming,
  fallbackModel?: string,
  attempts = 4,
): Promise<Anthropic.Message> {
  const tryModel = async (model: string): Promise<Anthropic.Message> => {
    let delay = 1500;
    for (let i = 0; ; i++) {
      try {
        return await client.messages.create({ ...params, model });
      } catch (e) {
        if (!isRetryable(e) || i >= attempts) throw e;
        await new Promise((r) => setTimeout(r, delay + Math.floor(Math.random() * 500)));
        delay = Math.min(delay * 2, 20_000);
      }
    }
  };
  try {
    return await tryModel(params.model);
  } catch (e) {
    if (fallbackModel && fallbackModel !== params.model && isRetryable(e)) {
      console.error(`[harness] ${params.model} overloaded — falling back to ${fallbackModel}`);
      return await tryModel(fallbackModel);
    }
    throw e;
  }
}

/** Generic tool-use loop shared by the main harness and its subagents. */
export async function agentLoop(opts: AgentLoopOptions): Promise<{ finalText: string; turns: number }> {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: opts.initialUser }];
  let finalText = "";
  let turn = 0;

  for (turn = 1; turn <= opts.maxTurns; turn++) {
    const resp = await callModel(
      opts.client,
      {
        model: opts.model,
        max_tokens: opts.maxTokens ?? 2048,
        system: opts.system,
        tools: opts.tools as unknown as Anthropic.Tool[],
        messages,
      },
      opts.fallbackModel,
    );
    opts.ledger.add(resp.model, resp.usage.input_tokens, resp.usage.output_tokens);
    messages.push({ role: "assistant", content: resp.content });

    const toolUses = resp.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    const text = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .trim();
    if (text) opts.onEvent?.({ kind: "assistant_text", detail: { text: text.slice(0, 400) } });

    if (resp.stop_reason !== "tool_use" || toolUses.length === 0) {
      finalText = text || finalText;
      break;
    }

    const results: Anthropic.ToolResultBlockParam[] = [];
    let stop = false;
    for (const tu of toolUses) {
      const out = await opts.dispatch(tu.name, (tu.input ?? {}) as Record<string, unknown>);
      results.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: out.text || "(no output)",
        is_error: out.isError,
      });
      if (out.stop) {
        stop = true;
        finalText = out.text;
      }
    }

    const userContent: Anthropic.ContentBlockParam[] = [...results];
    const trailing = opts.trailing?.();
    if (trailing) userContent.push({ type: "text", text: trailing });
    messages.push({ role: "user", content: userContent });

    if (stop) break;
  }

  return { finalText, turns: turn };
}

/** The local Anthropic tools the main harness implements (not from MCP). */
export function localToolDefs(): ToolDef[] {
  return [
    {
      name: "make_plan",
      description: "Draft an initial step-by-step plan for the goal. Call this FIRST, before investigating.",
      input_schema: {
        type: "object",
        properties: { steps: { type: "array", items: { type: "string" }, description: "Ordered steps." } },
        required: ["steps"],
      },
    },
    {
      name: "execute_step_in_plan",
      description: "Mark a plan step done and record the finding for it.",
      input_schema: {
        type: "object",
        properties: { step_id: { type: "number" }, finding: { type: "string" } },
        required: ["step_id", "finding"],
      },
    },
    {
      name: "update_plan",
      description:
        "Re-plan mid-run when a result surprises you or contradicts an assumption. State the reason and the new remaining steps.",
      input_schema: {
        type: "object",
        properties: { reason: { type: "string" }, steps: { type: "array", items: { type: "string" } } },
        required: ["reason", "steps"],
      },
    },
    {
      name: "write_file",
      description: "Save text to the scratchpad (keeps large content out of context). Returns a pointer.",
      input_schema: {
        type: "object",
        properties: { name: { type: "string" }, content: { type: "string" } },
        required: ["name", "content"],
      },
    },
    {
      name: "read_file",
      description: "Read a scratchpad file back by name.",
      input_schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
    },
    {
      name: "spawn_investigator",
      description:
        "Spawn an isolated investigator subagent to dig into ONE focused question against the warehouse + stats tools. It returns only a tight summary — use this to keep your own context clean.",
      input_schema: {
        type: "object",
        properties: {
          objective: { type: "string", description: "The single question to investigate." },
          context: { type: "string", description: "Minimal context the subagent needs." },
        },
        required: ["objective"],
      },
    },
    {
      name: "finish",
      description: "Finish the investigation with a concise summary of the most promising, verified opportunity.",
      input_schema: { type: "object", properties: { summary: { type: "string" } }, required: ["summary"] },
    },
  ];
}

export function newClient(): Anthropic {
  if (!config.anthropicApiKey) throw new Error("ANTHROPIC_API_KEY is not set (add it to .env).");
  return new Anthropic({ apiKey: config.anthropicApiKey, maxRetries: 5 });
}
