# Design decisions (build-vs-buy log)

This log records the project's major architectural choices and the alternatives considered.

## Language: TypeScript-first + a Python stats service over MCP
The application, harness, MCP servers, and agents use TypeScript so domain contracts can be shared across the monorepo. Statistics remain in a focused **Python Stats-Verifier MCP** because statsmodels and scipy provide mature implementations of STL, CUPED, and hypothesis tests. *Alternatives:* all-Python would weaken type sharing with the web application; pure TypeScript would require reimplementing specialized statistical routines. MCP keeps the polyglot boundary explicit and testable.

## Warehouse interface: read-only MCP, semantic-layer-first
The agents touch data only through a read-only MCP server (least-privilege, query timeout, per-query audit log, signed result artifacts). KPI questions resolve through a governed YAML semantic layer (`run_metric`) that **errors out-of-scope** rather than guessing; ad-hoc questions fall back to guarded `run_sql`. *Why:* the 2026 dbt benchmark shows semantic-layer answers are right ~98–100% in-scope and fail loudly out-of-scope, vs. ~64.5% for raw text-to-SQL.

## Verifier: two independent checks - statistics first, then groundedness
A finding is not asserted unless (1) the **statistical gate** passes - an independent query derives the arm counts, then the Python stats service rules (STL strips seasonality; two-proportion z + power on the holdout; CI must exclude 0) - and (2) the **groundedness cross-check** (`engine/groundedness.ts`) confirms the claim's numbers actually follow from the stored evidence. The groundedness check is deliberately **demote-only and fail-closed**: it can pull an accepted opportunity out of the ranked list (or demote on an unparseable verdict), never promote one - the statistics stay the source of truth. Every opportunity also carries stored **query provenance** (`sql` + result hash + fingerprint), so "traces to a returned query result" is a stored fact, not an implication. This prevents seasonal movement or demand capture from being presented as incremental impact.

## Ranking: reach × value × uplift
Opportunities are ranked by audience reach, outcome value, and verified incremental uplift. The third factor is causal rather than predictive, so demand-capture opportunities are demoted.

## Product systems remain distinct
- **Agentic discovery** is the long-running context-engineered harness.
- **Campaign generation** turns verified ideas into audience definitions, variants, and creative briefs.
- **Decisioning** is a separate contextual bandit in `decisioning/`, not part of the agent harness.

## Durability: step-journaled checkpoints (Inngest/DBOS the production target)
Implemented as an append-only **step journal** (`durable/journal.ts`) with Inngest-style `step.run` memoization: each step's result is journaled by name; on resume, completed steps return their cached result without re-executing. A crash mid-run leaves the journal on disk, so resuming replays it and continues (proven in `pnpm durable`). This externalizes the same state a durable engine would and demonstrates the hard seam transparently **without an external dev-server**. *Why it's safe:* read-only MCP/warehouse queries are naturally idempotent, so replay can't double-apply effects. *Production target:* **Inngest** (TS-native, observable timeline) or **DBOS** (pure-library); **Temporal** is overkill for a multi-hour horizon. The same pattern wraps the agent harness - externalize plan + scratchpad pointers + transcript per checkpoint and rehydrate on resume.

## Memory: typed, multi-level, verified-only
Structured insight/outcome records (not raw embeddings), keyed by subject across initiative/audience/journey/campaign/message, with a **verified-only write gate** (only Verifier-passed claims enter - prevents memory poisoning) and temporal validity (`valid_until`).

## Harness: custom loop on the Anthropic SDK (no second framework)
The harness mechanics (`make_plan`/`execute_step_in_plan`/`update_plan`, file-buffer scratchpad, summary-only subagents, plan regurgitation, Haiku fan-out, and model tiering) are implemented explicitly so each is inspectable. *Why not LangGraph:* a rigid DAG is a poor fit for open-ended marketing investigation because the model must be able to add branches in response to evidence.

Model tiering is two tiers that both actually run - Sonnet for orchestration/investigation, Haiku for breadth (explorer, fan-out, judges, guardrails, creative). An unused Opus "hard" escalation tier existed as config and was deliberately **removed**: config that claims a capability that never executes is exactly the kind of overstatement this project bans.
