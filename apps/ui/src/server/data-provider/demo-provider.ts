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
import boardData from "../../../public/board.json";
import { type DataProvider, sleep } from "./types";

const RUN = boardData as unknown as RunDetail;

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
  {
    id: "frequency_cap",
    rule: "Max 2 messages per customer per 7 days — machine-enforced (server: activation/caps.ts, device: @lift/sdk frequency ledger), not an LLM judgment.",
  },
];

function category(o: Opportunity): "found" | "rejected-trap" | "rejected-seasonal" | "needs-test" {
  if (o.accepted) return "found";
  if (o.verdict === "explained_by_seasonality") return "rejected-seasonal";
  if (o.verdict === "needs_test") return "needs-test";
  return "rejected-trap";
}

function buildActivity(run: RunDetail): EngineEvent[] {
  const events: EngineEvent[] = [];
  const candidates = [...run.opportunities.rejected, ...run.opportunities.ranked]; // rejections first, build to the wins
  events.push({ kind: "run_started", goal: run.goal, candidateCount: candidates.length });
  // Mirror the live engine's stage narrative: explorer → hypotheses → verify → prioritize.
  events.push({ kind: "explorer_started", probeCount: candidates.length });
  for (const o of candidates.slice(0, 3)) {
    events.push({
      kind: "hypothesis_proposed",
      text: o.hypothesis?.rationale ? `[${o.key}] ${o.hypothesis.rationale}` : `[${o.key}] ${o.segment} looks worth testing against the goal.`,
      matchedProbe: true,
    });
  }
  events.push({ kind: "planning", text: "Planning the investigation — scanning campaigns, segments, and the order time-series." });
  let cost = 0;
  for (const o of candidates) {
    events.push({ kind: "candidate_started", key: o.key, title: o.title });
    events.push({
      kind: "candidate_verified",
      key: o.key,
      title: o.title,
      category: category(o),
      detail: o.reason,
      grounded: o.accepted ? (o.grounded ? o.grounded.verdict === "pass" : true) : undefined,
    });
    cost += 0.015;
    events.push({ kind: "cost", usd: Number(cost.toFixed(3)) });
  }
  events.push({ kind: "prioritizing", acceptedCount: run.opportunities.ranked.length, formula: "reach × value × verified uplift" });
  events.push({ kind: "run_finished", result: run });
  return events;
}

function memoryFrom(run: RunDetail): InsightRecord[] {
  const out: InsightRecord[] = [];
  for (const o of [...run.opportunities.ranked, ...run.opportunities.rejected]) {
    let claim: string;
    if (o.accepted) claim = `${o.title}: verified ${o.upliftPp! >= 0 ? "+" : ""}${o.upliftPp?.toFixed(1)}pp incremental lift.`;
    else if (o.verdict === "explained_by_seasonality") claim = `${o.title}: seasonal pattern, not a real behavior change.`;
    else if (o.verdict === "needs_test") claim = `${o.title}: untargeted high-value cohort; needs a designed holdout.`;
    else claim = `${o.title}: high raw conversion but no incremental lift — not persuadable.`;
    out.push({
      subject: o.key,
      subjectType: o.type === "experiment" ? "campaign" : o.type === "seasonality" ? "initiative" : "audience",
      claim,
      verdict: o.verdict,
      confidence: o.accepted ? 0.9 : 0.85,
      validUntil: "2026-09-15",
    });
  }
  return out;
}

export const demoProvider: DataProvider = {
  mode: "demo",

  async listGoals() {
    return GOALS;
  },
  async getGuardrails() {
    return GUARDRAILS;
  },
  async getLatestRun() {
    return RUN;
  },
  async getActivity() {
    return buildActivity(RUN);
  },

  async *streamRun(goal, signal) {
    const events = buildActivity({ ...RUN, goal });
    for (const e of events) {
      await sleep(e.kind === "planning" ? 900 : e.kind === "candidate_verified" ? 520 : e.kind === "run_finished" ? 300 : 180, signal);
      yield e;
    }
  },

  async *streamActivation(_key, signal) {
    const result = RUN.activation!;
    yield { kind: "act_started", title: result.opportunity.title };
    for (const label of [
      "Compiling the audience…",
      "Drafting on-brand message variants…",
      "Checking brand guardrails…",
      `Syncing to ${result.sync?.destination ?? "the destination"}…`,
      "Measuring incremental lift against a holdout…",
    ]) {
      await sleep(650, signal);
      yield { kind: "step", label };
    }
    await sleep(400, signal);
    yield { kind: "act_finished", result };
  },

  async getActivation() {
    return RUN.activation!;
  },

  async listActivations(): Promise<ActivationSummary[]> {
    const a: ActivationResult = RUN.activation!;
    return [
      {
        opportunityKey: a.opportunity.key,
        title: a.opportunity.title,
        destination: a.sync?.destination ?? "—",
        audienceSize: a.audience.persuadableReach,
        upliftPp: a.measurement.upliftPp,
        pValue: a.measurement.pValue,
        verdict: a.measurement.verdict,
        status: "live",
        launchedAt: "2026-06-22",
      },
    ];
  },

  async getBandit(): Promise<BanditResult> {
    return RUN.bandit;
  },

  async listMemory() {
    return memoryFrom(RUN);
  },
};
