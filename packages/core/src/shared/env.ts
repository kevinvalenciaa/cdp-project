import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve, isAbsolute } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
// packages/core/src/shared -> repo root is four levels up
export const REPO_ROOT = resolve(here, "../../../..");

loadEnv({ path: resolve(REPO_ROOT, ".env") });

function envStr(key: string, fallback: string): string {
  const v = process.env[key];
  return v && v.length > 0 ? v : fallback;
}

function envInt(key: string, fallback: number): number {
  const v = process.env[key];
  const n = v ? Number.parseInt(v, 10) : Number.NaN;
  return Number.isFinite(n) ? n : fallback;
}

function fromRoot(p: string): string {
  return isAbsolute(p) ? p : resolve(REPO_ROOT, p);
}

export const config = {
  repoRoot: REPO_ROOT,
  duckdbPath: fromRoot(envStr("DUCKDB_PATH", "packages/core/data/lift_compass.duckdb")),
  seed: envInt("SEED", 42),
  queryTimeoutMs: envInt("QUERY_TIMEOUT_MS", 15_000),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  // Two tiers only, and both actually run: `reasoning` drives the harness orchestrator +
  // investigators; `fanout` (cheap) drives breadth work — explorer, classification fan-out,
  // the bare-LLM contrast judge, groundedness, guardrails, creative drafting. A third
  // "hard" escalation tier existed as config but nothing ever used it, so it was removed —
  // config that claims a capability that never runs is exactly the overstatement this
  // project bans.
  models: {
    reasoning: envStr("MODEL_REASONING", "claude-sonnet-4-6"),
    fanout: envStr("MODEL_FANOUT", "claude-haiku-4-5-20251001"),
  },
} as const;

export type Config = typeof config;
