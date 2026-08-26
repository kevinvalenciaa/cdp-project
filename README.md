# Proofloop

Proofloop is a prototype agentic customer data platform. It reads a warehouse, ranks marketing opportunities, verifies each one against a statistical holdout, drafts the activation work, and feeds measured outcomes back into memory so the next run starts better informed.

The ranking signal is **reach × value × incremental uplift**, not raw conversion. Every claim has to clear a statistics gate and a groundedness check before it can be promoted, so a campaign with 42% raw conversion and no incremental lift gets demoted instead of scaled.

For a non-technical overview, read [`docs/EXPLAINER.md`](docs/EXPLAINER.md) or open `/how-it-works` in the web app.

> **Status:** the agents, warehouse queries, statistics, verifier, memory, and bandit all run. Customer data is synthetic with a deterministic answer key in `packages/core/GROUND_TRUTH.md`. Campaign delivery and outcomes are simulated.

## How it works

```
goal → rank opportunities → draft audience and messaging → activate
     → measure lift against a holdout → write verified outcomes to memory → repeat
```

```mermaid
flowchart LR
  subgraph chain [Four-agent chain]
    E[Explorer<br/>hypotheses, Haiku] --> I[Investigators<br/>one per candidate]
    I --> P[Prioritizer<br/>reach x value x uplift]
    P --> V[Verifier<br/>stats + groundedness]
  end
  subgraph mcp [MCP boundary - least privilege]
    W[(Warehouse MCP<br/>read-only DuckDB)]
    S[Stats MCP<br/>STL - z-test - CUPED - power]
  end
  I -- run_metric / run_sql --> W
  V -- verify_lift_claim / assess_seasonality --> S
  V -- verified-only write gate --> M[(Compounding memory)]
  M -- prior insights, skip dead ends --> E
  V --> A[Activation: draft -> simulated sync -> holdout measure]
  A -- measured outcome --> M
```

Four design decisions carry most of the weight:

- **Statistics live outside the model.** Verdicts come from scipy and statsmodels in a separate Python service. The LLM groundedness check in `engine/groundedness.ts` is demote-only: it can remove an unsupported claim, never promote one.
- **Each investigator gets one objective** and returns a short summary, which keeps a long-running investigation from drowning in its own context.
- **Models are tiered by role.** Breadth work (Explorer, fan-out, judges) runs on Haiku; orchestration and reasoning run on Sonnet.
- **Ranking is arithmetic, not vibes.** `engine/prioritize.ts` multiplies reach, value, and verified uplift, so any ranking can be audited by hand.

## Repository layout

| Path | What it does |
|---|---|
| `packages/core/src/warehouse` | Deterministic synthetic DuckDB warehouse with planted ground truth |
| `packages/core/src/mcp-warehouse` | Read-only Warehouse MCP: `list_tables`, `get_schema`, `run_sql`, `run_metric`, `design_holdout`, plus audit log and result signatures |
| `services/stats` | Python Stats MCP: STL seasonality, two-proportion test, CUPED, power, `verify_lift_claim` |
| `packages/core/src/harness` | Agent harness: planning tools, file-buffer scratchpad, subagents, model tiering, cost ledger |
| `packages/core/src/engine` | Explorer → verifier → prioritizer, with a bare-LLM contrast and per-opportunity query provenance |
| `packages/core/src/memory` | Typed multi-level insights behind a verified-only write gate, with temporal validity |
| `packages/core/src/durable` | Step-journaled checkpoints and crash resume |
| `packages/core/src/activation` | Audience compiler, creative brief, variant drafter, simulated connectors |
| `packages/core/src/decisioning` | Contextual Thompson sampling per segment |
| `packages/core/src/delivery` | Compiles a verified opportunity into a decision bundle; holds the SQL-vs-device parity test |
| `packages/protocol` | Zod-only wire contract: decision bundle, events, forward-compatible decoder, golden vectors |
| `packages/sdk` | On-device eligibility: predicate matcher, frequency ledger, monotonic-clock windows, durable event queue |
| `apps/ui` | Next.js investigation workspace |
| `apps/device` | Expo/React Native host app with a live debug panel |

## Quick start

Requires Node 20+, pnpm 9.15.2, Python 3.11+, and [uv](https://docs.astral.sh/uv/).

```bash
pnpm run setup        # install Node and Python deps
pnpm seed             # build the synthetic warehouse and plant ground truth
pnpm ground-truth     # prove the planted signals are recoverable (10/10)
```

Commands marked *(key)* need `ANTHROPIC_API_KEY` in `.env`.

```bash
pnpm opportunities    # ranked board plus the bare-LLM contrast (key)
pnpm demo             # live agent harness trace (key)
pnpm fanout           # Haiku fan-out classifier and guardrails (key)
pnpm activate         # draft work, simulated activation, measured lift (key)
pnpm durable          # compounding memory and crash resume
pnpm bandit           # decisioning bandit

pnpm ui:dev           # web app at localhost:3000
pnpm device:dev       # Expo host app pointed at the web app
pnpm verify           # build, typecheck, unit tests, stats tests
```

If Sonnet is congested, prefix a command with `MODEL_REASONING=claude-haiku-4-5-20251001`. The harness also falls back to Haiku on its own.

## What it proves

These are asserted by exit-code gates (`pnpm ground-truth`, `pnpm opportunities`, `pnpm durable`), not just described. Realized numbers live in `packages/core/GROUND_TRUTH.md`.

- **It catches the trap.** The VIP campaign converts at ~42% but its lift confidence interval includes zero, so it gets demoted. The bare LLM accepts it: *"42% conversion is exceptional, scale it."*
- **It checks seasonality instead of guessing.** Shown a raw Q4 spike, the bare LLM can only hedge. The verifier has the series and the statistics: STL attributes nearly all of the spike to the seasonal component and rejects the claim with numbers.
- **It surfaces at least three real opportunities** (second-purchase SMS, spring product-drop creative, cross-category cross-sell), each with lift, p-value, a groundedness check, and stored query provenance.
- **It compounds.** Run two skips the killed trap from memory and re-verifies dead ends older than 14 days; crash resume replays journaled steps; the bandit beats the scripted human baseline by roughly 20%.

## Web application

`apps/ui` is a Next.js workspace for setting a goal, running an investigation, reviewing verified opportunities, approving activation work, and measuring outcomes. It supports persistent investigation chats, a per-chat results drawer, a workspace-wide latest-truth inbox, background runs, and revocable share snapshots. See [`docs/MULTIPLE_INVESTIGATIONS.md`](docs/MULTIPLE_INVESTIGATIONS.md) for the product model, Supabase schema, and worker process.

One environment flag swaps the data source behind an identical UI:

```bash
pnpm ui:dev                    # demo mode: fixture-backed, instant, no key required
LIFT_MODE=live pnpm ui:dev     # live mode: real engine over SSE (needs a key and a seeded warehouse)
```

## Delivery path

A verified opportunity compiles into a portable decision bundle that the device evaluates on its own. Two details are worth calling out:

- **One predicate, two evaluators.** The server compiles audience predicates to SQL; the device evaluates them with `matchPredicate`. `delivery/parity.test.ts` runs both against real `customer_360` rows and requires identical membership.
- **One frequency cap, two machines.** The server groups over `campaign_sends`; the device keeps a persisted ledger on monotonic-clock windows, so rolling the device date forward does not un-cap a user. When the clock is ambiguous, delivery is suppressed.

`decodeBundle` skips campaigns it does not understand and records the reason, so a newer server never breaks an older client. The event queue persists before flushing, deletes only on ack, and reports dropped events rather than hiding them. Scope is limited to in-app delivery; push would need APNs or FCM, and activation artifacts stay marked `"simulated": true`.

## Deploy

- **Demo on Vercel:** run `vercel`. The included `vercel.json` pins `LIFT_MODE=demo`, which needs no API key or Python runtime.
- **Live web and worker:** configure Supabase, build the image, then run `docker compose -f docker-compose.worker.yml up`. The web process serves Next.js; the worker owns leased assistant and engine jobs.

## Known limits

- `runAndReadAll` materializes full results server-side before applying the 1,000-row cap. The fix is a streaming reader with a pushed-down `LIMIT`.
- Single-file DuckDB behind one MCP process. Swapping in Snowflake or BigQuery with a connection pool is the path forward; the MCP contract is the part that survives.
- The device API has no per-workspace connector registry, so bundle and ingest routing is unauthenticated.
- Memory is a table scan. Fine at hundreds of insights, needs indexing and retrieval ranking at millions.
- The open-ended harness is less resumable than the investigation engine, which checkpoints its explorer, candidate, and ranking stages.

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — technical walkthrough
- [`docs/DESIGN_DECISIONS.md`](docs/DESIGN_DECISIONS.md) — build-vs-buy rationale
- [`docs/FANOUT_VS_RAG.md`](docs/FANOUT_VS_RAG.md) — why fan-out over retrieval
- [`docs/EXPLAINER.md`](docs/EXPLAINER.md) — non-technical overview
