import type {
  ActivationEvent,
  ActivationResult,
  ActivationSummary,
  BanditResult,
  EngineEvent,
  Goal,
  GuardrailRule,
  InsightRecord,
  RunDetail,
} from "@/lib/types";

/**
 * The single contract the UI talks to. Two implementations — demo (deterministic
 * fixtures + scripted streams) and live (the real @lift/core engine) — selected by
 * LIFT_MODE. The UI never knows which is active.
 */
export interface DataProvider {
  readonly mode: "demo" | "live";
  listGoals(): Promise<Goal[]>;
  getGuardrails(): Promise<GuardrailRule[]>;
  /** The most recent finished run (demo: always the fixture; live: from the store). */
  getLatestRun(): Promise<RunDetail | null>;
  /** Stream a discovery run for a goal (SSE source). */
  streamRun(goal: string, signal?: AbortSignal): AsyncGenerator<EngineEvent>;
  /** The latest run's activity log (for the Activity screen). */
  getActivity(): Promise<EngineEvent[]>;
  /** Stream the approve → launch flow for one opportunity. */
  streamActivation(opportunityKey: string, signal?: AbortSignal): AsyncGenerator<ActivationEvent>;
  getActivation(opportunityKey: string): Promise<ActivationResult>;
  listActivations(): Promise<ActivationSummary[]>;
  getBandit(): Promise<BanditResult>;
  listMemory(): Promise<InsightRecord[]>;
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((res, rej) => {
    const t = setTimeout(res, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      rej(new Error("aborted"));
    });
  });
}
