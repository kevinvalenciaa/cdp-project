import type { Provenance } from "./provenance.js";

export type Verdict =
  | "real_lift"
  | "no_significant_lift"
  | "explained_by_seasonality"
  | "needs_test";

export interface Opportunity {
  key: string;
  title: string;
  segment: string;
  type: "experiment" | "seasonality" | "segment";
  reach: number;
  value: number; // $ per conversion (or AOV proxy)
  rawConversion: number | null; // treatment conversion rate (what a naive view sees)
  upliftPp: number | null; // incremental lift in percentage points
  ci: [number, number] | null;
  pValue: number | null;
  verdict: Verdict;
  accepted: boolean; // only verified incremental wins are accepted
  score: number; // reach × value × uplift (0 if not accepted)
  reason: string;
  /** The headline a naive marketer sees — what the bare LLM judges. Null = no claim to judge. */
  naiveClaim: string | null;
  /** Side-by-side: what a bare LLM (no statistical verifier) concluded. Absent when there was no claim. */
  bareLlm?: { accepted: boolean; reason: string };
  /** Human-readable numeric facts backing the reason (rendered in the UI evidence tile). */
  evidence: Record<string, unknown>;
  /** Machine trail: executed SQL + fingerprints + the stats call — stored, not implied. */
  provenance: Provenance;
  /** Explorer-stage hypothesis that led here (static fallback when no LLM ran). */
  hypothesis?: { rationale: string; source: "llm" | "static" };
  /** Verifier check #2 — LLM groundedness cross-check of the claim vs its evidence. */
  grounded?: { verdict: "pass" | "demote" | "n/a"; reason: string };
}

export interface Hypothesis {
  key: string;
  title: string;
  rationale: string;
  kind: "experiment" | "seasonality" | "segment";
}

export interface EngineResult {
  goal: string;
  ranked: Opportunity[]; // accepted, sorted by score desc
  rejected: Opportunity[]; // demoted/rejected, with reasons
  contrastUsd: number; // cost of ALL side-channel LLM calls (explorer + bare judge + groundedness)
  generatedFromSeed: number;
  /** Explorer stage output: where hypotheses came from + honest surplus (proposed, no probe exists). */
  explorer?: { source: "llm" | "static"; surplus: Hypothesis[] };
  /** Candidates skipped because memory already holds a verified dead-end verdict for them. */
  skippedFromMemory?: { subject: string; claim: string }[];
  /** Side-channel LLM spend by stage (sums to contrastUsd). */
  costByStage?: { explorer: number; bareLlm: number; groundedness: number };
}
