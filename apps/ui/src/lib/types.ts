// Shared UI types. These mirror @lift/core's outputs (board.json shape) plus a few
// product-level additions. Both the demo and live data providers satisfy these.

export type Verdict = "real_lift" | "no_significant_lift" | "explained_by_seasonality" | "needs_test";

export interface Opportunity {
  key: string;
  title: string;
  segment: string;
  type: "experiment" | "seasonality" | "segment";
  reach: number;
  value: number;
  rawConversion: number | null;
  upliftPp: number | null;
  ci: [number, number] | null;
  pValue: number | null;
  verdict: Verdict;
  accepted: boolean;
  score: number;
  reason: string;
  bareLlm?: { accepted: boolean; reason: string };
  evidence?: Record<string, unknown>;
  // New engine fields (optional — older board.json fixtures predate them).
  naiveClaim?: string | null;
  provenance?: {
    queries: { sql: string; resultHash: string; fingerprint: string }[];
    stats: { tool: string; args: Record<string, unknown>; verdict: string } | null;
  };
  hypothesis?: { rationale: string; source: "llm" | "static" };
  grounded?: { verdict: "pass" | "demote" | "n/a"; reason: string };
}

export interface AudienceDef {
  label: string;
  channel: "sms" | "email" | "push";
  reach: number;
  persuadableReach: number;
  persuadableFilter: string;
  sampleMembers: number[];
}

export interface Variant {
  id: string;
  channel: string;
  text: string;
}

export interface Measurement {
  treatmentN: number;
  controlN: number;
  treatmentConv: number;
  controlConv: number;
  upliftPp: number;
  ci: [number, number];
  pValue: number;
  verdict: string;
}

export interface ActivationResult {
  opportunity: Opportunity;
  audience: AudienceDef;
  brief: string;
  variants: Variant[];
  guardrail: { allowed: boolean };
  sync: { destination: string; membersSynced: number; artifactPath: string } | null;
  measurement: Measurement;
  memoryWritten: boolean;
  costUsd: number;
}

export interface BanditResult {
  impressions: number;
  learnedBest: string[];
  oracleBest: string[];
  converged: boolean;
  banditRate: number;
  randomRate: number;
  globalBestRate: number;
  oracleRate: number;
  liftVsHoldout: number;
  liftVsGlobalBest: number;
  globalBestVariant: string;
}

export interface InsightRecord {
  subject: string;
  subjectType: string;
  claim: string;
  verdict: string;
  confidence: number;
  validUntil: string;
}

export interface Goal {
  id: string;
  label: string;
  preset: boolean;
}

/** The full payload behind the board (the existing board.json fixture). */
export interface RunDetail {
  goal: string;
  generatedAtSeed?: number;
  opportunities: { ranked: Opportunity[]; rejected: Opportunity[] };
  activation?: ActivationResult; // demo bundles it; live computes it on approve
  bandit: BanditResult;
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
  | { kind: "hypothesis_proposed"; text: string; matchedProbe: boolean }
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
    }
  | { kind: "prioritizing"; acceptedCount: number; formula: string }
  | { kind: "cost"; usd: number }
  | { kind: "run_finished"; result: RunDetail }
  | { kind: "error"; message: string };

/** Streaming events emitted while approving + launching an opportunity. */
export type ActivationEvent =
  | { kind: "act_started"; title: string }
  | { kind: "step"; label: string }
  | { kind: "act_finished"; result: ActivationResult }
  | { kind: "error"; message: string };

export interface GuardrailRule {
  id: string;
  rule: string;
}
