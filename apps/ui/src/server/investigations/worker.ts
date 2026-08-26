import { randomUUID } from "node:crypto";
import { monthlyImpact, moneyCompact, pp } from "@/lib/format";
import type {
  InvestigationContextV1,
  InvestigationMessage,
  JobRecord,
  OpportunityOccurrence,
  RequestContext,
} from "@/lib/investigations";
import type { EngineEvent } from "@/lib/types";
import { getProvider } from "@/server/data-provider";
import { getInvestigationRepository } from "./index";

const LEASE_SECONDS = 60;
/** How long to wait before re-draining a queue that still holds backed-off retries. */
const RETRY_SWEEP_MS = Math.max(250, Number(process.env.WORKER_RETRY_SWEEP_MS ?? 2_500));
const ASSISTANT_CONCURRENCY = Math.max(1, Number(process.env.ASSISTANT_WORKER_CONCURRENCY ?? 4));
const ENGINE_CONCURRENCY = Math.max(1, Number(process.env.ENGINE_WORKER_CONCURRENCY ?? 1));
const CONCURRENCY: Record<JobRecord["queue"], number> = {
  assistant: ASSISTANT_CONCURRENCY,
  engine: ENGINE_CONCURRENCY,
};
const activeControllers = new Map<string, AbortController>();

function workerContext(job: JobRecord): RequestContext {
  return {
    userId: "system-worker",
    email: "worker@lift.local",
    workspaceId: job.workspaceId,
    role: "owner",
  };
}

function routeMessage(content: string, forced: string, hasResults: boolean): "answer" | "investigate" | "clarify" {
  if (forced === "answer" || forced === "investigate") return forced;
  const normalized = content.trim().toLowerCase();
  if (normalized.length < 4 || /^(it|that|this|them|those)\??$/.test(normalized)) return "clarify";
  if (
    hasResults &&
    /^(why|what|which|how|explain|compare|summari[sz]e|tell me|walk me through|can you explain)\b/.test(normalized)
  ) {
    return "answer";
  }
  return "investigate";
}

function groundedAnswer(content: string, results: OpportunityOccurrence[]) {
  const proven = results.filter((result) => result.accepted).sort((a, b) => b.impactMonthly - a.impactMonthly);
  if (proven.length === 0) {
    return {
      content:
        "There are no currently proven opportunities in this investigation to answer from. Run fresh analysis so I can ground the answer in verified evidence.",
      citations: [],
    };
  }
  const compare = /\bcompare\b/i.test(content);
  const selected = compare ? proven.slice(0, 2) : proven.slice(0, 3);
  const lines = selected.map((result, index) => {
    const lift = result.opportunity.upliftPp == null ? "verified evidence" : `${pp(result.opportunity.upliftPp)} incremental lift`;
    return `${index + 1}. ${result.opportunity.title}: ~${moneyCompact(result.impactMonthly)}/mo from ${lift}. ${result.opportunity.reason}`;
  });
  return {
    content: `${compare ? "Here is the evidence-backed comparison" : "Here is what this investigation has proven"}:\n\n${lines.join(
      "\n\n",
    )}`,
    citations: selected.map((result) => result.id),
  };
}

/**
 * `message` and `results` are passed in rather than re-read: processAssistantJob
 * has already fetched both, and against the local repository each repeat read is
 * another synchronous parse of the whole state file.
 */
async function buildContext(
  job: JobRecord,
  message: InvestigationMessage,
  results: OpportunityOccurrence[],
): Promise<InvestigationContextV1> {
  const repository = await getInvestigationRepository();
  const investigation = await repository.getInvestigation(workerContext(job), job.investigationId);
  if (!investigation) throw new Error("Investigation no longer exists.");
  const workspaceInsights = await repository.listInsights(workerContext(job));
  return {
    version: 1,
    objective: investigation.objective,
    currentPrompt: message.content,
    recentMessages: investigation.messages.slice(-10).map(({ role, content }) => ({ role, content })),
    scopedResults: results.map((result) => ({
      occurrenceId: result.id,
      key: result.opportunityKey,
      title: result.opportunity.title,
      accepted: result.accepted,
      verdict: result.verdict,
      impactMonthly: result.impactMonthly,
      reason: result.opportunity.reason,
    })),
    referencedOccurrenceIds: results
      .filter(
        (result) =>
          message.content.toLowerCase().includes(result.opportunity.title.toLowerCase()) ||
          message.content.toLowerCase().includes(result.opportunityKey.toLowerCase()),
      )
      .map((result) => result.id),
    workspaceInsights: workspaceInsights.map(({ subject, claim, verdict }) => ({
      subject,
      claim,
      verdict,
    })),
  };
}

async function processAssistantJob(job: JobRecord): Promise<void> {
  const repository = await getInvestigationRepository();
  if (!job.messageId) throw new Error("Assistant job has no input message.");
  const message = await repository.getMessage(job.messageId);
  if (!message) throw new Error("Input message no longer exists.");
  const results = await repository.getScopedResults(job.investigationId);
  const intent = routeMessage(message.content, message.intent, results.length > 0);
  if (intent === "clarify") {
    await repository.completeClarification(
      message.id,
      "Which result or business outcome should I focus on? Name the opportunity, or ask me to run fresh analysis for a specific goal.",
    );
  } else if (intent === "answer") {
    const answer = groundedAnswer(message.content, results);
    await repository.completeAnswer(message.id, answer.content, answer.citations);
  } else {
    const context = await buildContext(job, message, results);
    await repository.enqueueRun(message.id, context, message.content);
  }
}

async function processEngineJob(job: JobRecord, workerId: string): Promise<void> {
  const repository = await getInvestigationRepository();
  if (!job.runId) throw new Error("Engine job has no run.");
  const run = await repository.getRun(job.runId);
  if (!run) throw new Error("Run no longer exists.");
  if (run.status === "cancelled") return;
  if (run.cancelRequested) {
    await repository.finalizeRunCancellation(run.id);
    return;
  }
  const checkpointEvents = await repository.getRunCheckpointEvents(run.id);
  await repository.markRunRunning(run.id);
  const provider = await getProvider();
  const controller = new AbortController();
  activeControllers.set(run.id, controller);
  const heartbeat = setInterval(() => {
    // A rejection here used to be unhandled: `void` silences the lint warning but
    // attaches no handler, and Node's default --unhandled-rejections=throw turns a
    // single transient DB blip into a dead web server mid-run.
    repository.heartbeatJob(job.id, workerId, LEASE_SECONDS).catch((error) => {
      console.error(`[worker] heartbeat failed for job ${job.id}:`, error);
    });
  }, 15_000);
  let eventIndex = 0;
  let result = null;
  let streamedCost: number | undefined;
  try {
    for await (const event of provider.streamRun(run.goal, controller.signal, {
      checkpointEvents,
      workspaceInsights: run.context.workspaceInsights,
    })) {
      if (await repository.isCancelRequested(run.id)) controller.abort();
      if (controller.signal.aborted) break;
      if (event.kind === "cost") streamedCost = event.usd;
      const eventWithCost =
        event.kind === "run_finished"
          ? { ...event, result: { ...event.result, costUsd: event.result.costUsd ?? streamedCost } }
          : event;
      if (eventWithCost.kind !== "run_finished") {
        await repository.appendEngineEvent(
          run,
          eventWithCost as EngineEvent,
          `${eventIndex++}:${event.kind}:${"key" in event ? String(event.key) : ""}`,
        );
      }
      if (eventWithCost.kind === "run_finished") result = eventWithCost.result;
      if (event.kind === "error") throw new Error(event.message);
    }
    if (controller.signal.aborted || (await repository.isCancelRequested(run.id))) {
      await repository.finalizeRunCancellation(run.id);
      return;
    }
    if (!result) throw new Error("The engine stream ended without a final result.");
    await repository.completeRun(run.id, result);
  } catch (error) {
    // A provider that tears its stream down on abort surfaces as a throw. That is
    // a cancellation the user asked for, not a failed attempt to retry.
    if (controller.signal.aborted || (await repository.isCancelRequested(run.id))) {
      await repository.finalizeRunCancellation(run.id);
      return;
    }
    throw error;
  } finally {
    clearInterval(heartbeat);
    activeControllers.delete(run.id);
  }
}

/** `retryPending` means the queue still holds work that is only waiting on a backoff. */
type DrainOutcome = { retryPending: boolean };

async function drain(queue: JobRecord["queue"]): Promise<DrainOutcome> {
  const repository = await getInvestigationRepository();
  const workerId = `${process.pid}:${queue}:${randomUUID()}`;
  let retryPending = false;
  while (true) {
    let job: JobRecord | null;
    try {
      // claimJob used to sit outside the try, so a transient failure rejected the
      // whole drain promise instead of ending the pass cleanly.
      job = await repository.claimJob(queue, workerId, LEASE_SECONDS);
    } catch (error) {
      console.error(`[worker] could not claim from the ${queue} queue:`, error);
      return { retryPending: true };
    }
    if (!job) return { retryPending };
    try {
      if (queue === "assistant") await processAssistantJob(job);
      else await processEngineJob(job, workerId);
      await repository.completeJob(job.id);
      // Routing an "investigate" turn enqueues an engine job. Wake that queue now
      // rather than depending on the assistant pass finishing first.
      if (queue === "assistant") pump("engine");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const terminal = job.attempts >= job.maxAttempts;
      try {
        if (terminal) {
          // Assistant jobs carry no runId, so failRun never fired for them and the
          // input message stayed "queued" forever. enqueueMessage then rejected
          // every later message with CONFLICT and the investigation was locked
          // with no way out - no send, no cancel, no archive.
          if (job.runId) await repository.failRun(job.runId, message);
          else if (job.messageId) await repository.failMessage(job.messageId, message);
        } else {
          retryPending = true;
        }
        await repository.failJob(job.id, message);
      } catch (bookkeepingError) {
        console.error(`[worker] could not record the failure of job ${job.id}:`, bookkeepingError);
        return { retryPending: true };
      }
    }
  }
}

type QueueState = {
  running: Promise<void> | null;
  rekick: boolean;
  sweep: ReturnType<typeof setTimeout> | null;
};

const queues: Record<JobRecord["queue"], QueueState> = {
  assistant: { running: null, rekick: false, sweep: null },
  engine: { running: null, rekick: false, sweep: null },
};

/**
 * Start a pass over `queue`, or record that another one is owed.
 *
 * The old version no-opped whenever a drain handle was non-null, and the handle
 * only cleared once every concurrent drain had already returned empty. A job
 * enqueued in that window was silently orphaned: nothing polls in the web
 * process, so the UI span on "Investigation running..." forever.
 */
function pump(queue: JobRecord["queue"]): void {
  const state = queues[queue];
  if (state.sweep) {
    clearTimeout(state.sweep);
    state.sweep = null;
  }
  if (state.running) {
    state.rekick = true;
    return;
  }
  state.rekick = false;
  state.running = Promise.all(Array.from({ length: CONCURRENCY[queue] }, () => drain(queue)))
    .then((outcomes) => outcomes.some((outcome) => outcome.retryPending))
    .catch((error) => {
      console.error(`[worker] the ${queue} drain failed:`, error);
      return true;
    })
    .then((retryPending) => {
      state.running = null;
      if (state.rekick) {
        pump(queue);
      } else if (retryPending) {
        // failJob defers a retry by a couple of seconds. Nothing else wakes the
        // queue inside the web process, so without this sweep one transient
        // failure parked the job indefinitely.
        state.sweep = setTimeout(() => {
          state.sweep = null;
          pump(queue);
        }, RETRY_SWEEP_MS);
        state.sweep.unref?.();
      }
    });
}

export function kickInvestigationWorkers(): void {
  pump("assistant");
  pump("engine");
}

/** Run both queues to quiescence in the caller's turn. Used by tests and the CLI. */
export async function drainInvestigationQueues(): Promise<void> {
  await drain("assistant");
  await drain("engine");
}

export function abortActiveRun(runId: string): void {
  activeControllers.get(runId)?.abort();
}

export async function runWorkerForever(): Promise<never> {
  while (true) {
    await Promise.all([
      ...Array.from({ length: ASSISTANT_CONCURRENCY }, () => drain("assistant")),
      ...Array.from({ length: ENGINE_CONCURRENCY }, () => drain("engine")),
    ]);
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
}
