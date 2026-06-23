import { resolve } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { REPO_ROOT, config } from "../shared/env.js";
import { CostLedger } from "../shared/cost.js";
import type { Plan, ToolDef, TraceEvent } from "../shared/types.js";
import { agentLoop, localToolDefs, newClient } from "./loop.js";
import { bridgeTools, callMcpTool, connectStats, connectWarehouse } from "./mcp-client.js";
import { PlanManager } from "./plan.js";
import { Scratchpad } from "./scratchpad.js";
import { runInvestigator } from "./subagent.js";

const BUFFER_THRESHOLD = 3000;

const SYSTEM = `You are the orchestrator of a marketing Opportunity Engine for a fashion retailer.
You investigate a synthetic warehouse through read-only MCP tools and produce ONE verified, high-impact opportunity.

Workflow:
- Call make_plan FIRST with a short ordered plan.
- Prefer run_metric (governed semantic layer) over run_sql; fall back to run_sql only for ad-hoc questions.
- Use spawn_investigator for a focused deep dive so your own context stays clean.
- The harness AUTO-SAVES large tool results to a scratchpad and gives you a pointer — read_file only if you need detail.
- CRITICAL: never claim an incremental lift without verify_lift_claim, and never call a spike a real change without assess_seasonality. High raw conversion is NOT proof of incremental lift.
- The goal may state an ASSUMPTION the team currently holds. Validate it first. If your evidence CONTRADICTS that assumption (e.g., a campaign with high conversion turns out to have no incremental lift), you MUST call update_plan to pivot your remaining steps — that is the correct behavior, not a failure.
- Be efficient with steps. Once you've validated the stated assumption and verified the strongest 1–2 candidates, call finish() — do NOT exhaustively re-check every campaign. finish() must name the segment, the incremental lift with significance (p-value + CI), and why it beats the high-conversion-but-non-incremental trap.`;

export interface RunResult {
  runId: string;
  goal: string;
  finalText: string;
  plan: Plan | null;
  planUpdates: number;
  trace: TraceEvent[];
  costUsd: number;
  costByModel: ReturnType<CostLedger["byModel"]>;
}

export class Harness {
  private trace: TraceEvent[] = [];
  private startMs = Date.now();
  private bufCount = 0;

  private constructor(
    readonly runId: string,
    private readonly client: Anthropic,
    private readonly warehouse: Client,
    private readonly stats: Client,
    private readonly mcpTools: ToolDef[],
    private readonly route: Map<string, Client>,
    private readonly plan: PlanManager,
    private readonly scratchpad: Scratchpad,
    private readonly ledger: CostLedger,
  ) {}

  static async create(runId = `run_${Date.now()}`): Promise<Harness> {
    const client = newClient();
    const warehouse = await connectWarehouse();
    const stats = await connectStats();
    const { tools, route } = await bridgeTools([warehouse, stats]);
    const scratchpad = new Scratchpad(resolve(REPO_ROOT, "runs", runId, "scratchpad"));
    return new Harness(runId, client, warehouse, stats, tools, route, new PlanManager(), scratchpad, new CostLedger());
  }

  private emit(kind: TraceEvent["kind"], detail: Record<string, unknown>): void {
    this.trace.push({ t: Date.now() - this.startMs, kind, detail });
  }

  private async dispatch(name: string, input: Record<string, unknown>) {
    switch (name) {
      case "make_plan": {
        const out = this.plan.make(this.goal, (input.steps as string[]) ?? []);
        this.emit("plan_made", { steps: input.steps });
        return { text: out };
      }
      case "execute_step_in_plan": {
        const out = this.plan.execute(Number(input.step_id), String(input.finding ?? ""));
        this.emit("step_executed", { step_id: input.step_id, finding: input.finding });
        return { text: out };
      }
      case "update_plan": {
        const out = this.plan.update(String(input.reason ?? ""), (input.steps as string[]) ?? []);
        this.emit("plan_updated", { reason: input.reason, steps: input.steps });
        return { text: out };
      }
      case "write_file": {
        const { file, bytes } = this.scratchpad.write(String(input.name), String(input.content ?? ""));
        return { text: `saved ${bytes} chars to scratchpad '${file}'.` };
      }
      case "read_file":
        try {
          return { text: this.scratchpad.read(String(input.name)) };
        } catch (e) {
          return { text: e instanceof Error ? e.message : String(e), isError: true };
        }
      case "spawn_investigator": {
        this.emit("subagent_spawned", { objective: input.objective });
        const report = await runInvestigator({
          client: this.client,
          model: config.models.reasoning,
          objective: String(input.objective),
          context: input.context ? String(input.context) : undefined,
          mcpClients: [this.warehouse, this.stats],
          ledger: this.ledger,
        });
        this.emit("subagent_returned", { summary: report });
        return { text: report };
      }
      case "finish":
        this.emit("finish", { summary: input.summary });
        return { text: String(input.summary ?? ""), stop: true };
      default:
        return this.dispatchMcp(name, input);
    }
  }

  private async dispatchMcp(name: string, input: Record<string, unknown>) {
    const client = this.route.get(name);
    if (!client) return { text: `unknown tool '${name}'`, isError: true };
    const r = await callMcpTool(client, name, input);
    this.emit("tool_call", { name, input, bytes: r.text.length, isError: r.isError });
    if (r.text.length > BUFFER_THRESHOLD) {
      const { file, bytes } = this.scratchpad.write(`${name}_${++this.bufCount}.json`, r.text);
      this.emit("tool_buffered", { name, file, bytes });
      return {
        text:
          `[large result: ${bytes} chars saved to scratchpad '${file}'. Preview:\n${r.text.slice(0, 600)}\n…\n` +
          `Call read_file('${file}') for the full payload.]`,
        isError: r.isError,
      };
    }
    return { text: r.text, isError: r.isError };
  }

  private goal = "";

  async run(goal: string): Promise<RunResult> {
    this.goal = goal;
    const { finalText: loopText } = await agentLoop({
      client: this.client,
      model: config.models.reasoning,
      system: SYSTEM,
      initialUser: `Goal: ${goal}`,
      tools: [...localToolDefs(), ...this.mcpTools],
      dispatch: (n, i) => this.dispatch(n, i),
      ledger: this.ledger,
      maxTurns: 24,
      maxTokens: 2048,
      fallbackModel: config.models.fanout,
      trailing: () => (this.plan.plan ? this.plan.reminder() : null),
      onEvent: (e) => this.trace.push({ t: Date.now() - this.startMs, ...e }),
    });

    const finishEvent = [...this.trace].reverse().find((e) => e.kind === "finish");
    return {
      runId: this.runId,
      goal,
      finalText: String(finishEvent?.detail.summary ?? loopText ?? ""),
      plan: this.plan.plan,
      planUpdates: this.plan.updateCount,
      trace: this.trace,
      costUsd: this.ledger.totalUsd(),
      costByModel: this.ledger.byModel(),
    };
  }

  async close(): Promise<void> {
    await this.warehouse.close();
    await this.stats.close();
  }
}
