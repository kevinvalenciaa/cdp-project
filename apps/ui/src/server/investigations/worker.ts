import { randomUUID } from "node:crypto";
import { monthlyImpact, moneyCompact, pp } from "@/lib/format";
import type {
  InvestigationContextV1,
  JobRecord,
  OpportunityOccurrence,
  RequestContext,
} from "@/lib/investigations";
import type { EngineEvent } from "@/lib/types";
import { getProvider } from "@/server/data-provider";
import { getInvestigationRepository } from "./index";

const LEASE_SECONDS = 60;
const ASSISTANT_CONCURRENCY = Math.max(1, Number(process.env.ASSISTANT_WORKER_CONCURRENCY ?? 4));
const ENGINE_CONCURRENCY = Math.max(1, Number(process.env.ENGINE_WORKER_CONCURRENCY ?? 1));
const activeControllers = new Map<string, AbortController>();
let assistantDrain: Promise<void> | null = null;
let engineDrain: Promise<void> | null = null;

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

async function buildContext(job: JobRecord, messageId: string): Promise<InvestigationContextV1> {
  const repository = await getInvestigationRepository();
  const message = await repository.getMessage(messageId);
  if (!message) throw new Error("Input message no longer exists.");
  const investigation = await repository.getInvestigation(workerContext(job), job.investigationId);
  if (!investigation) throw new Error("Investigation no longer exists.");
  const [results, workspaceInsights] = await Promise.all([
    repository.getScopedResults(job.investigationId),
    repository.listInsights(workerContext(job)),
  ]);
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
    const context = await buildContext(job, message.id);
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
    void repository.heartbeatJob(job.id, workerId, LEASE_SECONDS);
  }, 15_000);
  let eventIndex = 0;
  let result = null;
  let streamedCost: number | undefined;
  try {
    for await (const event of provider.streamRun(run.goal, controller.signal, {
      checkpointEvents,
      workspaceInsights: run.context.workspaceInsights,
    })) {
      const latest = await repository.getRun(run.id);
      if (latest?.cancelRequested) controller.abort();
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
    const finalRun = await repository.getRun(run.id);
    if (finalRun?.cancelRequested || controller.signal.aborted) {
      await repository.finalizeRunCancellation(run.id);
      return;
    }
    if (!result) throw new Error("The engine stream ended without a final result.");
    await repository.completeRun(run.id, result);
  } finally {
    clearInterval(heartbeat);
    activeControllers.delete(run.id);
  }
}

async function drain(queue: JobRecord["queue"]): Promise<void> {
  const repository = await getInvestigationRepository();
  const workerId = `${process.pid}:${queue}:${randomUUID()}`;
  while (true) {
    const job = await repository.claimJob(queue, workerId, LEASE_SECONDS);
    if (!job) return;
    try {
      if (queue === "assistant") await processAssistantJob(job);
      else await processEngineJob(job, workerId);
      await repository.completeJob(job.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (job.runId && job.attempts >= job.maxAttempts) await repository.failRun(job.runId, message);
      await repository.failJob(job.id, message);
    }
  }
}

export function kickInvestigationWorkers(): void {
  if (!assistantDrain) {
    assistantDrain = Promise.all(
      Array.from({ length: ASSISTANT_CONCURRENCY }, () => drain("assistant")),
    ).then(() => undefined).finally(() => {
      assistantDrain = null;
      // Routing may have enqueued an engine job after the engine drain checked
      // an empty queue, so give that queue one more finite drain.
      if (!engineDrain) {
        engineDrain = Promise.all(
          Array.from({ length: ENGINE_CONCURRENCY }, () => drain("engine")),
        ).then(() => undefined).finally(() => {
          engineDrain = null;
        });
      }
    });
  }
  if (!engineDrain) {
    engineDrain = Promise.all(
      Array.from({ length: ENGINE_CONCURRENCY }, () => drain("engine")),
    ).then(() => undefined).finally(() => {
      engineDrain = null;
    });
  }
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
