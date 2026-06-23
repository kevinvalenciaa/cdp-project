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
  /** Side-by-side: what a bare LLM (no statistical verifier) concluded. */
  bareLlm?: { accepted: boolean; reason: string };
  evidence: Record<string, unknown>;
}

export interface EngineResult {
  goal: string;
  ranked: Opportunity[]; // accepted, sorted by score desc
  rejected: Opportunity[]; // demoted/rejected, with reasons
  contrastUsd: number; // cost of the bare-LLM contrast calls
  generatedFromSeed: number;
}
