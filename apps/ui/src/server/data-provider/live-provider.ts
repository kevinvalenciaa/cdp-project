import { activateOpportunity, Memory, runBandit, runEngineStreaming, type EngineStreamEvent } from "@lift/core";
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
import { store } from "@/server/store";
import { release, tryAcquire } from "@/server/run-lock";
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
  { id: "premium_brand_tone", rule: "Premium messaging stays aspirational — no aggressive discount/urgency language." },
  { id: "frequency_cap", rule: "Do not send more than 2 messages to the same customer within a week." },
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

  streamRun(goal, signal) {
    return bridge<EngineEvent>(async (push) => {
      if (!tryAcquire("run")) {
        push({ kind: "error", message: "A discovery run is already in progress." });
        return;
      }
      const activity: EngineEvent[] = [];
      const emit = (e: EngineEvent) => {
        if (e.kind !== "run_finished") activity.push(e);
        push(e);
      };
      try {
        // The run_finished handoff is deferred until after the engine resolves so we can
        // attach a DRAFT activation for the top opportunity (the Plan tab's content) before
        // persisting — this is what keeps live mode at parity with the demo fixture.
        let finished: { result: Parameters<typeof toRunDetail>[0]; bandit: unknown } | null = null;
        await runEngineStreaming(
          goal,
          (ce: EngineStreamEvent) => {
            if (ce.kind === "run_started") emit({ kind: "run_started", goal: ce.goal, candidateCount: ce.candidateCount });
            else if (ce.kind === "explorer_started") emit({ kind: "explorer_started", probeCount: ce.probeCount });
            else if (ce.kind === "hypothesis_proposed")
              emit({ kind: "hypothesis_proposed", text: `[${ce.hypothesis.key}] ${ce.hypothesis.rationale}`, matchedProbe: ce.matchedProbe });
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
              });
            else if (ce.kind === "prioritizing") emit({ kind: "prioritizing", acceptedCount: ce.acceptedCount, formula: ce.formula });
            else if (ce.kind === "cost") emit({ kind: "cost", usd: ce.usd });
            else if (ce.kind === "run_finished") finished = { result: ce.result, bandit: ce.bandit };
          },
          { withBareLlmContrast: true, memory: true },
        );
        if (finished) {
          const { result, bandit } = finished as { result: Parameters<typeof toRunDetail>[0]; bandit: unknown };
          let activation: ActivationResult | undefined;
          const top = (result.ranked as Opportunity[])[0];
          if (top) {
            emit({ kind: "planning", text: `Drafting a launch plan for “${top.title}”…` });
            try {
              activation = (await activateOpportunity(`live-${Date.now()}`, top.key)) as unknown as ActivationResult;
            } catch {
              /* draft is best-effort — the Plan tab shows its pre-launch placeholder */
            }
          }
          const detail = toRunDetail(result, bandit, goal, activation);
          store.saveRun(detail, activity);
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
        const result = (await activateOpportunity(`live-${Date.now()}`, key)) as unknown as ActivationResult;
        store.addActivation({
          opportunityKey: result.opportunity.key,
          title: result.opportunity.title,
          destination: result.sync?.destination ?? "—",
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
    return (await activateOpportunity(`live-${Date.now()}`, key)) as unknown as ActivationResult;
  },
  async listActivations(): Promise<ActivationSummary[]> {
    return store.listActivations();
  },
  async getBandit(): Promise<BanditResult> {
    return runBandit(42) as unknown as BanditResult;
  },
  async listMemory(): Promise<InsightRecord[]> {
    const mem = await Memory.open();
    const records = await mem.getValid();
    mem.close();
    return records.map((r) => ({
      subject: r.subject,
      subjectType: String(r.subjectType),
      claim: r.claim,
      verdict: r.verdict,
      confidence: r.confidence,
      validUntil: r.validUntil,
    }));
  },
};
