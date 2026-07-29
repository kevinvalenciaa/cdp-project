# ARCHITECTURE.md — the system, top-down

Study material, not doc theater: this walks the whole system in plain language, names the
real files, and includes the gaps. If you can explain every section here out loud, you can
defend the project under questioning.

## 1. Entry points

Every root `pnpm` script maps to a runner in `packages/core/src/run/`:

| Command | Runs | Needs API key? | Needs stats server? |
|---|---|---|---|
| `pnpm seed` | `warehouse/seed.ts` — builds the DuckDB warehouse + writes `GROUND_TRUTH.md` | no | no |
| `pnpm ground-truth` | `warehouse/ground-truth.ts` — proves every planted signal is recoverable (exit-code gate) | no | no |
| `pnpm opportunities` | `run/opportunities.ts` — the ranked board, streamed live with stage headers + the bare-LLM contrast (gated) | **yes** | **yes** (`pnpm stats:serve`) |
| `pnpm demo` | `run/demo.ts` — the LLM harness investigating one goal (plan, pivot, subagent, scratchpad) | **yes** | **yes** |
| `pnpm fanout` | `run/fanout-demo.ts` — parallel Haiku classification + guardrails | **yes** | no |
| `pnpm durable` | `run/durable-demo.ts` — memory compounding + crash-resume (deterministic, $0) | no | **yes** |
| `pnpm activate` | `run/activate-demo.ts` — draft work → simulated sync → measured holdout | **yes** | **yes** |
| `pnpm bandit` | `run/bandit-demo.ts` — the AI-Decisioning analog (pure simulation) | no | no |
| `pnpm board:data` | `run/board-data.ts` — regenerates the UI demo fixture (`apps/ui/public/board.json`) | **yes** | **yes** |
| `pnpm ui:dev` | the Next.js product app; `LIFT_MODE=demo` (fixture) or `live` (real engine over SSE) | live only | live only |
| `pnpm verify` | build (core+ui) + typecheck + vitest + pytest + the $0 stream gate | no | stream gate: yes |

## 2. Two execution paths, on purpose

- **The LLM harness** (`packages/core/src/harness/`) — open-ended investigation. An
  orchestrator (Sonnet) makes a plan, queries through MCP, pivots with `update_plan` when
  evidence contradicts the goal's assumption, spawns summary-only investigator subagents,
  and buffers large payloads to a scratchpad. Non-deterministic by nature; this is the
  "agentic" surface.
- **The deterministic engine** (`packages/core/src/engine/`) — the provable spine. Same
  Verifier, same warehouse, zero LLM in the accept/score path, reproducible from `SEED`.
  Every demo gate and golden artifact runs here, so the claims in the README are
  exit-code-checkable.

They share the MCP clients (`harness/mcp-client.ts`), the stats service, the memory store,
and the cost ledger. The design point: **the parts that must be trusted are deterministic;
the parts that must be creative are not** — and they never trade places.

## 3. File map

```
packages/core/src/
  warehouse/       seed.ts (generator) · config.ts (the planted answer key) · ground-truth*.ts (gates + GROUND_TRUTH.md)
  mcp-warehouse/   warehouse.ts (read-only DuckDB core) · server.ts (MCP tools) · semantic.ts + semantic/metrics.yaml · audit.ts
  harness/         harness.ts (orchestrator) · loop.ts (agent loop) · plan.ts · scratchpad.ts · subagent.ts · mcp-client.ts
  engine/          engine.ts (verifyExperiment + runEngine) · engine-streaming.ts · explorer.ts · prioritize.ts ·
                   groundedness.ts · provenance.ts · fanout.ts · types.ts
  memory/          store.ts (typed insights + write gate) · insights.ts (verdict→insight mapping)
  durable/         journal.ts (step journal) · durable-run.ts (journaled pipeline + revalidation)
  activation/      audience.ts · creative.ts · connectors.ts (simulated) · activate.ts
  decisioning/     bandit.ts (Thompson sampling — the AI-Decisioning analog)
  guardrails/      guard.ts + guardrails.yaml (composable-context rules)
  shared/          env.ts (config) · cost.ts (ledger) · db.ts (write path, seeding only) · rng.ts · concurrency.ts
  run/             one runner per pnpm command (see §1)
apps/ui/src/
  server/          data-provider/ (demo vs live seam) · store.ts · run-lock.ts · sse.ts
  components/      opportunity/ · detail/ · activity/ · launched/ · shell/ · charts/
services/stats/src/stats_server/   server.py (FastMCP tools) · stats.py (STL, z-test, CUPED, power)
```

## 4. Control flow of one engine run

`runEngine` (`engine/engine.ts`) — the streaming variant emits an event at each arrow:

1. **Explore** (`explorer.ts`) — Haiku proposes typed hypotheses from the goal + campaign
   catalog + prior memory. Hard invariant: hypotheses can **annotate** a known probe or
   **overflow** into an honest `surplus` list, but can never add or remove probes — so the
   LLM adds breadth and rationale without touching determinism. No key → static fallback.
2. **Memory skip-filter** (`memory/insights.ts`) — candidates with a fresh verified
   dead-end verdict are skipped (`memory_hit`), not re-litigated.
3. **Investigate/verify in parallel** (`shared/concurrency.ts` mapLimit, 4 at a time) —
   per candidate: arm counts via `run_sql` → `verify_lift_claim` on the stats service.
   Seasonality goes through STL (`assess_seasonality`); the underserved cohort is sized and
   marked `needs_test` (no fabricated lift).
4. **Bare-LLM contrast** — each opportunity's `naiveClaim` (raw conversion, or the raw
   spike) is judged by a bare Haiku call with no stats tools. Side-channel only: it never
   affects acceptance. Empirically it accepts the VIP incrementality trap outright; on the
   seasonal spike it hedges "can't tell without the baseline" — it can't verify what the
   Verifier then proves with STL. Both sides of that asymmetry are gate-asserted.
5. **Groundedness** (`groundedness.ts`) — verifier check #2, demote-only, fail-closed.
6. **Prioritize** (`prioritize.ts`) — `score = reach × value × max(0, verified lift)`;
   rejected tiered by reach × value. Plain arithmetic, key-tiebreak, parallel-safe.
7. **Memory write-back** — `toInsight` per opportunity through the verified-only gate,
   with run ids + query fingerprints in the evidence.

## 5. The MCP boundary (least privilege, enforced in the engine not the prompt)

`mcp-warehouse/warehouse.ts`:
- **READ_ONLY open, no fallback** — a failed read-only open throws loudly; the warehouse
  can never silently reopen writable. (Seeding uses the separate `shared/db.ts` write path.)
- **`assertReadOnly`** — single-statement, SELECT/WITH-only, write/DDL keyword rejection.
- **Timeout that kills** — on expiry the query is `interrupt()`ed inside DuckDB, not just
  abandoned; the connection is immediately reusable (test-proven).
- **Row cap with honest accounting** — 1,000 rows returned, true `rowCount` + `truncated`
  flag reported, sha256 result signature on every response.
- **Audit log** — every tool call appends `{tool, sql, rowCount, resultHash, durationMs}`.
- **Semantic layer** (`semantic.ts` + `metrics.yaml`) — governed metrics resolve
  deterministically (synonyms absorb naming drift); out-of-scope requests **error instead
  of guessing**; single-table by design (`customer_360` is the governed pre-join).

## 6. Durability — and the known gap

The **deterministic pipeline is journaled** (`durable/journal.ts`): each `verify:<key>`
step's result is appended to `runs/<id>/journal.jsonl`; a crash mid-run resumes by
replaying completed steps (safe because read-only queries are idempotent). Stale memory
dead-ends (>14 days) are cheaply re-verified and `revalidate()`d rather than trusted.

**Known gap, on purpose and documented:** the LLM harness loop itself is *not* journaled.
The intended approach is the same seam applied one level up — externalize the plan, the
scratchpad pointers, and the transcript at each checkpoint, rehydrate on resume — with
Inngest or DBOS as the production runner. A documented, reasoned gap beats a half-wired
dependency.

## 7. The provenance chain

Every claim is traceable end-to-end:

```
SQL text + warehouse resultHash ──sha256──► fingerprint (engine/provenance.ts)
        └► Opportunity.provenance.queries[] + .stats {tool, args, verdict}
                  └► memory evidence JSON {runIds, fingerprints} (memory/insights.ts)
                            └► UI evidence tile / audit surfaces
```

So "every claim traces to a specific query result" is a **stored fact** you can grep, not
an assertion. The audit log holds the same hashes server-side.

## 8. Cost tiering + the ledger

Two tiers, both real (`shared/env.ts`): **Sonnet** (`models.reasoning`) for the harness
orchestrator + investigators; **Haiku** (`models.fanout`) for the explorer, fan-out
classification, the bare judge, groundedness, guardrails, and creative drafting. Every
API call lands in `CostLedger` (`shared/cost.ts`); engine results carry `costByStage`
(explorer / bareLlm / groundedness) and harness runs report `costUsd` + `costByModel`.
An unused Opus escalation tier was removed rather than left as résumé config.

## 9. Build-vs-buy

Every dependency decision (TypeScript-first + Python stats over MCP, custom harness vs
LangGraph, step journal vs Inngest-now, typed memory vs embeddings, fan-out vs vector DB)
is argued in [`DESIGN_DECISIONS.md`](DESIGN_DECISIONS.md) — that file is the interview
answer sheet for "why didn't you just use X?".
