# Lift Compass — a causally-credible Agentic CDP

A working prototype of the [Agentic CDP](https://hightouch.com/blog/the-agentic-cdp) Hightouch announced in June 2026: agents that run continuously and hand a marketer a short, **ranked, proven** list of opportunities with draft work — instead of a blank canvas.

Its differentiator is **causal credibility**: it ranks opportunities by **reach × value × incremental uplift** (not raw conversion) and **proves each one with a holdout**. A separable **Verifier** rejects anything the data can't support — and visibly catches a planted trap that a normal LLM falls for.

> **New here? Read [`docs/EXPLAINER.md`](docs/EXPLAINER.md)** (plain language, no jargon), or open the `/how-it-works` page in the UI.

> **Prototype, not a product.** The agents, data queries, statistics, verifier, memory, and bandit are **real and working**. The customer data is **synthetic** (with a known answer key, so results are *provably* correct — see `packages/core/GROUND_TRUTH.md`). Campaign sending and outcomes are **simulated**. The harness is **context-engineering, not RL** — the bandit is a separate AI-Decisioning analog.

## The loop (closed)

```
goal → discover ranked opportunities → draft work (audience + messaging + creative brief)
     → AMP-analog assets → (simulated) activation → measure incremental lift with a holdout
     → optimize the per-segment message (bandit) → write verified outcomes to memory → smarter next run
```

## Three Hightouch systems, kept distinct
- **Agentic CDP** — the long-running, context-engineered agent harness (what this mirrors).
- **AMP** (Agentic Marketing Platform) — turns ideas into campaign assets (a thin analog: brief + variant drafter).
- **AI Decisioning** — a *separate* RL/bandit product (analogized in `packages/core/src/decisioning`, never conflated with the harness).

## Architecture

| Component | Where | What |
|---|---|---|
| Synthetic warehouse | `packages/core/src/warehouse` | DuckDB, deterministic, planted ground truth (`GROUND_TRUTH.md`) |
| **Read-only Warehouse MCP** | `packages/core/src/mcp-warehouse` | `list_tables`/`get_schema`/`run_sql`/`run_metric` (semantic layer, errors out-of-scope)/`design_holdout`; audit log + result signatures |
| **Stats Verifier MCP** (Python) | `services/stats` | STL seasonality, two-proportion test, CUPED, power, `verify_lift_claim` |
| **Agent harness** | `packages/core/src/harness` | `make_plan`/`update_plan`, file-buffer scratchpad, subagents, model tiering, cost ledger |
| **Opportunity engine + Verifier** | `packages/core/src/engine` | explore → verify (stats gate) → rank by reach×value×uplift; bare-LLM contrast |
| Fan-out + guardrails | `packages/core/src/engine/fanout.ts`, `src/guardrails` | parallel Haiku classification; composable-context business rules |
| **Compounding memory** | `packages/core/src/memory` | typed multi-level insights, verified-only write gate, temporal validity |
| **Durable execution** | `packages/core/src/durable` | step-journaled checkpoints; crash-resume |
| Activation + AMP-analog | `packages/core/src/activation` | audience compiler, creative brief, variant drafter, simulated connectors |
| AI-Decisioning bandit | `packages/core/src/decisioning` | contextual Thompson-sampling per segment |
| Opportunity board UI | `apps/ui` | Next.js static board + `/how-it-works` |

See [`docs/DESIGN_DECISIONS.md`](docs/DESIGN_DECISIONS.md) for the build-vs-buy rationale and [`docs/FANOUT_VS_RAG.md`](docs/FANOUT_VS_RAG.md).

## Quick start

```bash
pnpm setup            # install Node + Python (uv) deps
pnpm seed             # build the synthetic warehouse + plant ground truth
pnpm ground-truth     # prove the planted signals are recoverable (10/10)

# Each phase is independently runnable (★ = needs ANTHROPIC_API_KEY in .env):
pnpm opportunities ★  # ranked board + bare-LLM contrast (the differentiator)
pnpm demo          ★  # the live agent harness trace
pnpm fanout        ★  # Haiku fan-out classifier + guardrails
pnpm durable          # compounding memory + crash-resume (no key)
pnpm activate      ★  # draft work → simulated activation → measured lift
pnpm bandit           # AI-Decisioning bandit (no key)

pnpm board:data    ★  # regenerate the demo fixture (apps/ui/public/board.json)
pnpm ui:dev           # the product app at localhost:3000 (demo mode — instant, no key)

pnpm verify           # automated suite: build (core+ui) + typecheck + unit tests + stats tests
```
*If Sonnet 4.6 is congested, prefix `MODEL_REASONING=claude-haiku-4-5-20251001` — the harness also auto-falls back to Haiku.*

## What it proves (vs. the ground-truth answer key)
- **Catches the trap:** the VIP campaign (42% conversion) has ~0 incremental lift (CI includes 0) → demoted; a bare LLM accepts it.
- **Rejects seasonality:** the Q4 order surge is flagged "explained by seasonality," not a real change.
- **Surfaces the real win:** second-purchase SMS, +6.2pp lift (p=0.041), confirmed on activation (+10pp targeting persuadables).
- **Compounds:** run 2 skips the killed trap from memory; crash-resume replays journaled steps; the bandit beats "human marketing" by ~20%.

## The product app (Lift Compass UI)

`apps/ui` is a Next.js app — the marketer's "Opportunity Inbox": pick a goal → run discovery → watch the agents work → review proven opportunities → approve & launch → see measured results. Screens: Opportunities, Activity, Launched & Measuring, Memory, Settings.

One env flag (`LIFT_MODE`) swaps the data source behind an identical UI:
- **`demo`** (default) — deterministic, instant, $0, no API/Python. Reads the `board.json` fixture and scripts the streamed activity. Deployable to Vercel; the shareable artifact.
- **`live`** — the real `@lift/core` engine, streamed over SSE (Server-Sent Events). Runs a real ~45s discovery, persists it, and renders the same UI.

```bash
pnpm ui:dev                          # demo mode (no key) → localhost:3000
LIFT_MODE=live pnpm ui:dev           # live mode (needs ANTHROPIC_API_KEY + the seeded warehouse)
```

## Deploy

- **Demo → Vercel** (the shareable URL): `vercel` (uses `vercel.json`; `LIFT_MODE=demo`, no key, no Python). The live engine never loads, so no native deps are needed at runtime.
- **Live → one container**: `docker build -t lift-compass . && docker run -e ANTHROPIC_API_KEY=... -p 3000:3000 lift-compass` (the `Dockerfile` installs Node 20 + Python 3.11 + uv, seeds the warehouse, and runs `LIFT_MODE=live next start`). Put it behind basic auth before exposing publicly.
