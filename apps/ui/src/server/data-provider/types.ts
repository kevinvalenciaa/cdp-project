import type { DecisionBundle, EventBatch, IngestAck } from "@lift/protocol";
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
 * The single contract the UI talks to. Two implementations - demo (deterministic
 * fixtures + scripted streams) and live (the real @lift/core engine) - selected by
 * LIFT_MODE. The UI never knows which is active.
 */
export interface DataProvider {
  readonly mode: "demo" | "live";
  listGoals(): Promise<Goal[]>;
  getGuardrails(): Promise<GuardrailRule[]>;
  /** The most recent finished run (demo: always the fixture; live: from the store). */
  getLatestRun(): Promise<RunDetail | null>;
  /** Stream a discovery run for a goal (SSE source). */
  streamRun(
    goal: string,
    signal?: AbortSignal,
    execution?: {
      checkpointEvents: EngineEvent[];
      workspaceInsights: Array<{ subject: string; claim: string; verdict: string }>;
    },
  ): AsyncGenerator<EngineEvent>;
  /** The latest run's activity log (for the Activity screen). */
  getActivity(): Promise<EngineEvent[]>;
  /** Stream the approve → launch flow for one opportunity. */
  streamActivation(opportunityKey: string, signal?: AbortSignal): AsyncGenerator<ActivationEvent>;
  getActivation(opportunityKey: string): Promise<ActivationResult>;
  listActivations(): Promise<ActivationSummary[]>;
  getBandit(): Promise<BanditResult>;
  listMemory(): Promise<InsightRecord[]>;
  /** The current decision bundle for devices (etag = content-hash bundle_id), or null if none compiled. */
  getBundle(): Promise<{ bundle: DecisionBundle; etag: string } | null>;
  /** Accept a device event batch (durable, deduped by batch_id). */
  ingest(batch: EventBatch): Promise<IngestAck>;
}

/**
 * Resolves early on abort rather than rejecting.
 *
 * Rejecting made cancellation look like a crash: the demo provider sits in here
 * for most of a run, so aborting threw out of the consumer's `for await` before
 * it could reach its own cancellation handling, and the worker booked it as a
 * failed attempt. Callers detect cancellation by checking `signal.aborted` after
 * the await, which is what every caller here already does.
 *
 * The listener is registered with `once` and removed on the normal path, so a
 * long run does not pile up one listener per event on a single signal.
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", finish);
      resolve();
    };
    timer = setTimeout(finish, ms);
    signal?.addEventListener("abort", finish, { once: true });
  });
}
