// UI types. Wire/domain shapes come STRAIGHT from their sources of truth —
// type-only re-exports (erased by verbatimModuleSyntax, so the demo runtime
// never loads core) instead of the 165 hand-copied mirror lines that used to
// live here and drift. Only genuinely UI-local view types are declared below.

import type { ActivationResult as CoreActivationResult, InsightRecord as CoreInsightRecord } from "@lift/core";

export type {
  Verdict,
  Opportunity,
  Hypothesis,
  AudienceDef,
  Variant,
  ActivationResult,
  BanditResult,
  Rule as GuardrailRule,
} from "@lift/core";

/** The holdout measurement block, as core computes it. */
export type Measurement = CoreActivationResult["measurement"];

/** The UI renders a projection of memory records; core keeps ids/evidence. */
export type InsightRecord = Pick<
  CoreInsightRecord,
  "subject" | "subjectType" | "claim" | "verdict" | "confidence" | "validUntil"
>;

// ---------------------------------------------------------------------------
// UI-local view types (not mirrors — these exist only for the product UI).
// ---------------------------------------------------------------------------

export interface Goal {
  id: string;
  label: string;
  preset: boolean;
}

/** The full payload behind the board (the board.json fixture / live run). */
export interface RunDetail {
  goal: string;
  generatedAtSeed?: number;
  opportunities: { ranked: import("@lift/core").Opportunity[]; rejected: import("@lift/core").Opportunity[] };
  activation?: CoreActivationResult; // demo bundles it; live computes it on approve
  bandit: import("@lift/core").BanditResult;
  costUsd?: number;
  finishedAt?: string;
}

export interface RunSummary {
  id: string;
  goal: string;
  status: "running" | "done" | "error";
  acceptedCount: number;
  rejectedCount: number;
  costUsd: number;
  finishedAt: string | null;
}

export interface ActivationSummary {
  opportunityKey: string;
  title: string;
  destination: string;
  audienceSize: number;
  upliftPp: number;
  pValue: number;
  verdict: string;
  status: "live";
  launchedAt: string;
}

/** Streaming events emitted during a discovery run (live SSE + demo script). */
export type EngineEvent =
  | { kind: "run_started"; goal: string; candidateCount: number }
  | { kind: "explorer_started"; probeCount: number }
  | {
      kind: "hypothesis_proposed";
      text: string;
      matchedProbe: boolean;
      hypothesis?: import("@lift/core").Hypothesis;
      source?: "llm" | "static";
    }
  | { kind: "planning"; text: string }
  | { kind: "memory_hit"; subject: string; claim: string }
  | { kind: "candidate_started"; key: string; title: string }
  | {
      kind: "candidate_verified";
      key: string;
      title: string;
      category: "found" | "rejected-trap" | "rejected-seasonal" | "needs-test";
      detail: string;
      /** Verifier check #2 (groundedness) — present for accepted candidates in live runs. */
      grounded?: boolean;
      /** Full immutable checkpoint payload; UI renderers may ignore it. */
      opportunity?: import("@lift/core").Opportunity;
    }
  | { kind: "prioritizing"; acceptedCount: number; formula: string }
  | { kind: "cost"; usd: number }
  | { kind: "run_finished"; result: RunDetail }
  | { kind: "error"; message: string };

/** Streaming events emitted while approving + launching an opportunity. */
export type ActivationEvent =
  | { kind: "act_started"; title: string }
  | { kind: "step"; label: string }
  | { kind: "act_finished"; result: CoreActivationResult }
  | { kind: "error"; message: string };
