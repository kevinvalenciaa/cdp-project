# Lift Compass

A transparent, warehouse-native **closed-loop Agentic CDP** prototype: it ranks marketing opportunities by **reach × value × incremental uplift**, produces reviewable draft work, (simulated-)activates the audience, **proves** each one with a designed holdout, and optimizes the message with a bandit — differentiating on **causal credibility and auditability**, not more automation.

It is a faithful, honest prototype of the [Agentic CDP](https://hightouch.com/blog/the-agentic-cdp) Hightouch announced in June 2026. New to it? Read [`docs/EXPLAINER.md`](docs/EXPLAINER.md) (plain language, no jargon).

> **Prototype, not a product.** The agents, data queries, statistics, verifier, memory, and bandit are real and working. The customer data is **synthetic** (with a known answer key, so results are provably correct). Campaign sending and outcomes are **simulated**. See the "What's real vs. simulated" section below.

## The loop

`goal → discover opportunities → draft work (audience + messaging + creative brief) → AMP-analog assets → (simulated) activation → measure incremental lift with a holdout → optimize per-segment message (bandit) → write verified outcomes to compounding memory → smarter next run`

## Three Hightouch systems, kept distinct

- **Agentic CDP** — the long-running, context-engineered agent harness (what this mirrors).
- **AMP** — turns ideas into campaign assets (thin analog here: variant drafter + creative brief).
- **AI Decisioning** — a *separate* RL/bandit product (analogized here in `packages/core/src/decisioning`, never conflated with the harness).

## Layout

| Path | What |
|---|---|
| `packages/core` | TypeScript backend: warehouse seed, MCP servers, harness, agents, activation, decisioning, outcomes, memory, durable orchestration |
| `services/stats` | Python Stats-Verifier MCP (statsmodels STL, scipy, CUPED) |
| `apps/ui` | Next.js opportunity board + `/how-it-works` page |
| `docs/` | EXPLAINER, DESIGN_DECISIONS, FANOUT_VS_RAG |

## Quick start

```bash
pnpm setup            # installs Node + Python deps (uv)
pnpm seed             # build the synthetic warehouse + plant ground truth
pnpm ground-truth     # prove the planted signals are recoverable
pnpm mcp:warehouse    # start the read-only warehouse MCP server
# Phase 2+ (the agent loop) needs ANTHROPIC_API_KEY in .env:
pnpm demo             # run the closed-loop demo
pnpm verify           # full automated verification suite
```

See [`docs/`](docs) and the build plan for the full design. Verification (automated + a manual checklist) is in the plan's §9.

## Status

Built in public, phase by phase. See the task list / commit history for current progress.
