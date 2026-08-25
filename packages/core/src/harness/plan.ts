import type { Plan } from "../shared/types.js";

/**
 * Plan/execute separation with dynamic re-planning (the core harness
 * mechanic). The plan is mutable, regurgitated at the end of context, and NOT a DAG.
 */
export class PlanManager {
  plan: Plan | null = null;
  updateCount = 0;

  make(goal: string, steps: string[]): string {
    this.plan = { goal, steps: steps.map((d, i) => ({ id: i + 1, description: d, status: "pending" })) };
    return this.render();
  }

  update(reason: string, steps: string[]): string {
    if (!this.plan) throw new Error("call make_plan before update_plan");
    // Re-planning appends/replaces remaining work; completed steps are not re-run.
    const done = this.plan.steps.filter((s) => s.status === "done");
    this.plan.steps = [
      ...done,
      ...steps.map((d, i) => ({ id: done.length + i + 1, description: d, status: "pending" as const })),
    ];
    this.updateCount += 1;
    return `Plan updated (reason: ${reason}).\n${this.render()}`;
  }

  execute(stepId: number, finding: string): string {
    if (!this.plan) throw new Error("no plan");
    const step = this.plan.steps.find((s) => s.id === stepId);
    if (!step) throw new Error(`no step ${stepId}`);
    step.status = "done";
    return `Step ${stepId} done: ${finding}\n${this.render()}`;
  }

  render(): string {
    if (!this.plan) return "(no plan yet)";
    return `GOAL: ${this.plan.goal}\nPLAN:\n${this.plan.steps
      .map((s) => `  ${s.id}. [${s.status}] ${s.description}`)
      .join("\n")}`;
  }

  /** Regurgitated at the END of context each turn to exploit recency bias. */
  reminder(): string {
    return `[plan reminder - keep this goal salient]\n${this.render()}`;
  }
}
