import {
  activateOpportunity,
  compileDecisionBundle,
  connectWarehouse,
  Memory,
  runBandit,
  runEngineStreaming,
  type EngineStreamEvent,
} from "@lift/core";
import type { DecisionBundle } from "@lift/protocol";
import type {
  ActivationEvent,
  ActivationResult,
  ActivationSummary,
  BanditResult,
  EngineEvent,
  Goal,
  GuardrailRule,
  InsightRecord,
  Opportunity,
  RunDetail,
} from "@/lib/types";
import { ingestBatch, renderDeliveryClaim, type SuppressionAggregate } from "@/server/delivery/ingest-store";
import { store } from "@/server/store";
import { acquire, release } from "@/server/run-lock";
import { type DataProvider, sleep } from "./types";

const GOALS: Goal[] = [
  { id: "second-purchase", label: "Grow second purchases from one-time buyers", preset: true },
  { id: "purchase-frequency", label: "Increase purchase frequency, especially among workwear buyers", preset: true },
  { id: "product-launch", label: "Make this fall’s flagship product launch a breakout success", preset: true },
  { id: "churn", label: "Reduce churn among first-time buyers", preset: true },
];

const GUARDRAILS: GuardrailRule[] = [
  { id: "premium_no_discount", rule: "Never propose discounts or promo codes on premium / never-on-sale collections (e.g., Fall Flagship)." },
  { id: "seasonality_not_opportunity", rule: "Do not present an expected seasonal increase as a new opportunity or a behavior change." },
  { id: "premium_brand_tone", rule: "Premium messaging stays aspirational - no aggressive discount/urgency language." },
  {
    id: "frequency_cap",
    rule: "Max 2 messages per customer per 7 days - machine-enforced (server: activation/caps.ts, device: @lift/sdk frequency ledger), not an LLM judgment.",
  },
];

type Category = "found" | "rejected-trap" | "rejected-seasonal" | "needs-test";
function categoryOf(o: { accepted: boolean; verdict: string }): Category {
  if (o.accepted) return "found";
  if (o.verdict === "explained_by_seasonality") return "rejected-seasonal";
  if (o.verdict === "needs_test") return "needs-test";
  return "rejected-trap";
}

function toRunDetail(
  result: { ranked: unknown[]; rejected: unknown[]; generatedFromSeed: number },
  bandit: unknown,
  goal: string,
  activation?: ActivationResult,
): RunDetail {
  return {
    goal,
    generatedAtSeed: result.generatedFromSeed,
    opportunities: { ranked: result.ranked as Opportunity[], rejected: result.rejected as Opportunity[] },
    activation,
    bandit: bandit as BanditResult,
  };
}

function resumeState(events: EngineEvent[]) {
  const candidateEvents = events.filter(
    (
      event,
    ): event is Extract<EngineEvent, { kind: "candidate_verified" }> & {
      opportunity: Opportunity;
    } => event.kind === "candidate_verified" && event.opportunity != null,
  );
  const hypothesisEvents = events.filter(
    (
      event,
    ): event is Extract<EngineEvent, { kind: "hypothesis_proposed" }> & {
      hypothesis: NonNullable<Extract<EngineEvent, { kind: "hypothesis_proposed" }>["hypothesis"]>;
    } => event.kind === "hypothesis_proposed" && event.hypothesis != null,
  );
  const explorerComplete = events.some(
    (event) =>
      event.kind === "planning" &&
      event.text.startsWith("Planning the investigation"),
  );
  return {
    opportunities: candidateEvents.map((event) => event.opportunity),
    ...(explorerComplete && hypothesisEvents.length > 0
      ? {
          explorer: {
            source: hypothesisEvents[0]?.source ?? "static",
            matched: hypothesisEvents
              .filter((event) => event.matchedProbe)
              .map((event) => event.hypothesis),
            surplus: hypothesisEvents
              .filter((event) => !event.matchedProbe)
              .map((event) => event.hypothesis),
          },
        }
      : {}),
  };
}

/** Bridge a callback-driven runner into an async generator for SSE. */
async function* bridge<E>(runner: (push: (e: E) => void) => Promise<void>, signal?: AbortSignal): AsyncGenerator<E> {
  const queue: E[] = [];
  let notify: (() => void) | null = null;
  let finished = false;
  let error: unknown = null;
  const push = (e: E) => {
    queue.push(e);
    notify?.();
    notify = null;
  };
  runner(push)
    .then(() => {
      finished = true;
      notify?.();
    })
    .catch((e) => {
      error = e;
      finished = true;
      notify?.();
    });
  while (true) {
    if (signal?.aborted) return;
    if (queue.length) {
      yield queue.shift() as E;
      continue;
    }
    if (finished) break;
    await new Promise<void>((r) => (notify = r));
  }
  if (error) throw error;
}

export const liveProvider: DataProvider = {
  mode: "live",

  async listGoals() {
    return GOALS;
  },
  async getGuardrails() {
    return GUARDRAILS;
  },
  async getLatestRun() {
    return store.getLatestRun();
  },
  async getActivity() {
    return store.getActivity();
  },

  streamRun(goal, signal, execution) {
    return bridge<EngineEvent>(async (push) => {
      // Queue behind an in-flight run instead of refusing. The worker rethrows
      // error events, and a rethrow is a failed attempt: three fast retries all
      // lost the same race and the run was marked failed, so the user was told
      // "The investigation failed." for work that was merely waiting its turn.
      if (!(await acquire("run"))) {
        push({ kind: "error", message: "Timed out waiting for the in-progress discovery run to finish." });
        return;
      }
      if (signal?.aborted) {
        release("run");
        return;
      }
      // Kept so the finished run can be persisted with its activity log, which is
      // what /api/bundle and the Activity screen read back.
      const emitted: EngineEvent[] = [];
      const emit = (e: EngineEvent) => {
        emitted.push(e);
        push(e);
      };
      try {
        // The run_finished handoff is deferred until after the engine resolves so we can
        // attach a DRAFT activation for the top opportunity (the Plan tab's content) before
        // persisting - this is what keeps live mode at parity with the demo fixture.
        let finished: { result: Parameters<typeof toRunDetail>[0]; bandit: unknown } | null = null;
        await runEngineStreaming(
          goal,
          (ce: EngineStreamEvent) => {
            if (ce.kind === "run_started") emit({ kind: "run_started", goal: ce.goal, candidateCount: ce.candidateCount });
            else if (ce.kind === "explorer_started") emit({ kind: "explorer_started", probeCount: ce.probeCount });
            else if (ce.kind === "hypothesis_proposed")
              emit({
                kind: "hypothesis_proposed",
                text: `[${ce.hypothesis.key}] ${ce.hypothesis.rationale}`,
                matchedProbe: ce.matchedProbe,
                hypothesis: ce.hypothesis,
                source: ce.source,
              });
            else if (ce.kind === "planning") emit({ kind: "planning", text: ce.text });
            else if (ce.kind === "memory_hit") emit({ kind: "memory_hit", subject: ce.subject, claim: ce.claim });
            else if (ce.kind === "candidate_started") emit({ kind: "candidate_started", key: ce.key, title: ce.title });
            else if (ce.kind === "candidate_verified")
              emit({
                kind: "candidate_verified",
                key: ce.opportunity.key,
                title: ce.opportunity.title,
                category: categoryOf(ce.opportunity),
                detail: ce.opportunity.reason,
                grounded: ce.opportunity.grounded && ce.opportunity.grounded.verdict !== "n/a" ? ce.opportunity.grounded.verdict === "pass" : undefined,
                opportunity: ce.opportunity,
              });
            else if (ce.kind === "prioritizing") emit({ kind: "prioritizing", acceptedCount: ce.acceptedCount, formula: ce.formula });
            else if (ce.kind === "cost") emit({ kind: "cost", usd: ce.usd });
            else if (ce.kind === "run_finished") finished = { result: ce.result, bandit: ce.bandit };
          },
          {
            withBareLlmContrast: true,
            // runEngineStreaming gates its insight writeback on this flag. With
            // it off, live runs stopped persisting verified insights to the core
            // Memory store, while ingest's uplinkToMemory kept writing
            // device-observed delivery facts into that same store for nobody to
            // read - the "device tells the next run what delivery did" loop was
            // write-only. The repository's own insights still ride in via
            // priorInsights; these are the durable engine-side ones.
            memory: true,
            priorInsights: execution?.workspaceInsights,
            resume: resumeState(execution?.checkpointEvents ?? []),
          },
        );
        if (finished) {
          const { result, bandit } = finished as { result: Parameters<typeof toRunDetail>[0]; bandit: unknown };
          let activation: ActivationResult | undefined;
          const top = (result.ranked as Opportunity[])[0];
          if (top) {
            emit({ kind: "planning", text: `Drafting a launch plan for “${top.title}”…` });
            try {
              activation = await activateOpportunity(`live-${Date.now()}`, top.key);
            } catch {
              /* draft is best-effort - the Plan tab shows its pre-launch placeholder */
            }
          }
          const detail = toRunDetail(result, bandit, goal, activation);
          // getBundle() compiles from store.getLatestRun()?.activation. When the
          // investigations pipeline took over persistence, the only saveRun call
          // was removed but getBundle was left reading it, so /api/bundle
          // answered 404 forever in live mode however many runs completed - the
          // device delivery loop could never receive a bundle.
          store.saveRun(detail, emitted);
          push({ kind: "run_finished", result: detail });
        }
      } catch (e) {
        push({ kind: "error", message: String(e) });
      } finally {
        release("run");
      }
    }, signal);
  },

  streamActivation(key, signal) {
    return bridge<ActivationEvent>(async (push) => {
      push({ kind: "act_started", title: key });
      for (const label of [
        "Compiling the audience…",
        "Drafting on-brand message variants…",
        "Checking brand guardrails…",
        "Activating to the destination…",
        "Measuring incremental lift against a holdout…",
      ]) {
        await sleep(300, signal);
        push({ kind: "step", label });
      }
      try {
        const result = await activateOpportunity(`live-${Date.now()}`, key);
        // /launched and the dashboard tile read store.listActivations() in live
        // mode; without this the launch was recorded nowhere the UI looks.
        store.addActivation({
          opportunityKey: result.opportunity.key,
          title: result.opportunity.title,
          destination: result.sync?.destination ?? "-",
          audienceSize: result.audience.persuadableReach,
          upliftPp: result.measurement.upliftPp,
          pValue: result.measurement.pValue,
          verdict: result.measurement.verdict,
          status: "live",
          launchedAt: new Date().toISOString().slice(0, 10),
        });
        push({ kind: "act_finished", result });
      } catch (e) {
        push({ kind: "error", message: String(e) });
      }
    }, signal);
  },

  async getActivation(key) {
    return activateOpportunity(`live-${Date.now()}`, key);
  },
  async listActivations(): Promise<ActivationSummary[]> {
    return store.listActivations();
  },
  async getBandit(): Promise<BanditResult> {
    return runBandit(42);
  },
  async listMemory(): Promise<InsightRecord[]> {
    const mem = await Memory.open();
    const records = await mem.getValid();
    mem.close();
    return records.map((r) => ({
      subject: r.subject,
      subjectType: r.subjectType,
      claim: r.claim,
      verdict: r.verdict,
      confidence: r.confidence,
      validUntil: r.validUntil,
    }));
  },

  async getBundle() {
    // Compile from the latest stored run's draft activation; cache by the
    // activation identity so repeated polls reuse the content-hashed bundle.
    const run = store.getLatestRun();
    const activation = run?.activation;
    if (!activation) return null;
    const cacheKey = `${activation.opportunity.key}|${activation.sync?.artifactPath ?? "unsynced"}`;
    if (liveBundleCache?.key === cacheKey) return liveBundleCache.value;
    const wh = await connectWarehouse();
    try {
      const bundle: DecisionBundle = await compileDecisionBundle(wh, "live-bundle", activation);
      liveBundleCache = { key: cacheKey, value: { bundle, etag: bundle.bundle_id } };
      return liveBundleCache.value;
    } finally {
      await wh.close();
    }
  },

  async ingest(batch) {
    const { ack, aggregate } = ingestBatch(batch);
    // The uplink: device-observed delivery facts land in agent Memory, so the
    // NEXT explorer run reads what delivery actually did (explorer.ts already
    // renders prior insights into its prompt - no engine change needed).
    if (aggregate) await uplinkToMemory(batch.batch_id, aggregate);
    return ack;
  },
};

/**
 * Short-lived Memory open/write/close with jittered retry - memory.duckdb is
 * single-writer and an activation may hold it briefly. On final failure we log
 * and move on: events + aggregate are already durable, the aggregate is
 * cumulative, and write() supersedes per subject, so the NEXT batch self-heals
 * the insight.
 */
async function uplinkToMemory(batchId: string, aggregate: SuppressionAggregate): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const mem = await Memory.open();
      try {
        for (const [key, row] of Object.entries(aggregate)) {
          await mem.write({
            runId: batchId,
            subject: `${key}#delivery`,
            subjectType: "campaign",
            claim: renderDeliveryClaim(key, row),
            verdict: "observed_delivery",
            evidence: JSON.stringify(row),
            confidence: 1,
          });
        }
      } finally {
        mem.close();
      }
      return;
    } catch (err) {
      if (attempt === 2) {
        console.error(`memory uplink failed after 3 attempts (will self-heal on next batch): ${String(err)}`);
        return;
      }
      await new Promise((r) => setTimeout(r, 200 + Math.floor(Math.random() * 200)));
    }
  }
}

let liveBundleCache: { key: string; value: { bundle: DecisionBundle; etag: string } } | null = null;
