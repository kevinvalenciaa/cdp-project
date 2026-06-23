# Design decisions (build-vs-buy log)

Since Hightouch runs no programming interviews, this log is part of the artifact: it explains *why* each choice was made, with the alternatives considered.

## Language: TypeScript-first + a Python stats service over MCP
Hightouch is a TypeScript/JS monorepo; "alignment with Hightouch" is a scored interview dimension, so the harness, MCP servers, agents, and UI are TypeScript. The one place Python clearly wins is statistics (statsmodels STL, scipy, CUPED), so that lives in a small **Python Stats-Verifier MCP** the TS harness calls over MCP — which is Hightouch's own "bring the AI to where the capability lives / compose over MCP" thesis applied internally. *Alternative:* all-Python (faster solo, but worse alignment); pure-TS (reimplement STL — error-prone). The MCP bridge turns the one polyglot seam into a talking point.

## Warehouse interface: read-only MCP, semantic-layer-first
The agents touch data only through a read-only MCP server (least-privilege, query timeout, per-query audit log, signed result artifacts). KPI questions resolve through a governed YAML semantic layer (`run_metric`) that **errors out-of-scope** rather than guessing; ad-hoc questions fall back to guarded `run_sql`. *Why:* the 2026 dbt benchmark shows semantic-layer answers are right ~98–100% in-scope and fail loudly out-of-scope, vs. ~64.5% for raw text-to-SQL.

## Verifier: independent re-query + statistics + LLM faithfulness
A finding is not asserted unless (1) an independent query re-derives the number, (2) statistical gates pass (STL strips seasonality; z/t-test beats baseline variance; holdout is valid; CUPED uplift CI excludes 0), and (3) an LLM faithfulness judge confirms the narrative is grounded. *Why:* directly answers Hightouch's #1 documented failure ("confused seasonal movement with a meaningful change").

## Ranking: reach × value × uplift (a sharpening of their published reach × value × likelihood)
Hightouch ranks by "how many customers it could reach, what the outcome is worth, and how likely the idea is to work." We make the third factor *causal* — incremental uplift over a holdout — and demote demand-capture (non-incremental) opportunities.

## Three Hightouch systems, kept distinct
- **Agentic CDP** = the long-running harness (context-engineering over LLMs) — what we mirror.
- **AMP** (Agentic Marketing Platform) = turns ideas into campaign assets — we ship a thin analog (variant drafter + creative brief).
- **AI Decisioning** = a *separate* RL/bandit product — our `decisioning/` bandit is an explicit analog, in its own module, never conflated with the harness.

## Durability: step-journaled checkpoints (Inngest/DBOS the production target)
Implemented as an append-only **step journal** (`durable/journal.ts`) with Inngest-style `step.run` memoization: each step's result is journaled by name; on resume, completed steps return their cached result without re-executing. A crash mid-run leaves the journal on disk, so resuming replays it and continues (proven in `pnpm durable`). This externalizes the same state a durable engine would and demonstrates the hard seam transparently **without an external dev-server**. *Why it's safe:* read-only MCP/warehouse queries are naturally idempotent, so replay can't double-apply effects. *Production target:* **Inngest** (TS-native, observable timeline) or **DBOS** (pure-library); **Temporal** is overkill for a multi-hour horizon. The same pattern wraps the agent harness — externalize plan + scratchpad pointers + transcript per checkpoint and rehydrate on resume.

## Memory: typed, multi-level, verified-only
Structured insight/outcome records (not raw embeddings), keyed by subject across initiative/audience/journey/campaign/message, with a **verified-only write gate** (only Verifier-passed claims enter — prevents memory poisoning) and temporal validity (`valid_until`).

## Harness: custom loop on the Anthropic SDK (no second framework)
The Hightouch harness mechanics (`make_plan`/`execute_step_in_plan`/`update_plan`, file-buffer scratchpad, summary-only subagents, plan regurgitation, Haiku fan-out, model tiering) are implemented explicitly so each is inspectable and defensible. *Why not LangGraph:* a rigid DAG is a poor fit for open-ended marketing investigation — the model must add a branch it couldn't know it needed at authoring time. *(Decision finalized when Phase 2 lands; see harness/README.)*
