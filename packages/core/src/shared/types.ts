export type StepStatus = "pending" | "in_progress" | "done" | "skipped";

export interface PlanStep {
  id: number;
  description: string;
  status: StepStatus;
}

export interface Plan {
  goal: string;
  steps: PlanStep[];
}

/** One entry in the run trace (what the harness did, step by step). */
export interface TraceEvent {
  t: number; // ms since run start
  kind:
    | "plan_made"
    | "plan_updated"
    | "step_executed"
    | "tool_call"
    | "tool_buffered"
    | "subagent_spawned"
    | "subagent_returned"
    | "assistant_text"
    | "finish";
  detail: Record<string, unknown>;
}

/** A bridged tool exposed to the model (Anthropic tool shape). */
export interface ToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}
