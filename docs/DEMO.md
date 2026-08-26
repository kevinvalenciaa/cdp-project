# 3-minute demo script

A runbook for the recorded walkthrough. Each beat has the command and what to point at.
Prefix agent commands with `MODEL_REASONING=claude-haiku-4-5-20251001` if Sonnet is congested.

## 0:00–0:20 - The job-to-be-done
> "A marketer asks: grow second purchases from one-time buyers. Most tools give 30 undifferentiated ideas. Watch this give a short, ranked list - each proven with a holdout."

Show the board: `pnpm ui:dev` → open `localhost:3000`.
(`board.json` and `bundle.json` are committed, so there is nothing to regenerate.
`pnpm board` rebuilds them from a real engine run and needs `ANTHROPIC_API_KEY`.)

## 0:20–0:50 - The harness thinking
Run `pnpm demo`. Point at the trace:
- the initial **plan**, then a mid-run **`update_plan`** firing when the verifier kills the VIP assumption,
- a large result **buffered to the scratchpad** (pointer-only in context),
- an **investigator subagent** returning a tight summary,
- **`total_cost_usd`** printed (~$0.22 on Haiku).

## 0:50–1:20 - Warehouse-native + cost tiering
- `pnpm mcp:call run_metric '{"metric":"churn_rate","groupBy":["value_tier"]}'` → governed answer.
- `pnpm mcp:call run_metric '{"metric":"profit_margin"}'` → **errors out-of-scope** instead of hallucinating.
- `pnpm fanout` → 36 creatives classified in parallel (~6× speedup, ~$0.008, no vector store).

## 1:20–2:10 - THE CLIMAX: causal credibility
Run `pnpm opportunities`. On the board / in the output:
- **Second-purchase SMS** ranked high: +6.2pp lift, p=0.041, CI excludes 0.
- **VIP loyalty (42% conversion)** demoted: lift +0.0pp, CI includes 0.
- The **bare LLM ACCEPTS** the VIP trap ("42% exceeds benchmarks"); the **Verifier REJECTS** it. ⚠️ disagree.
- The **Q4 surge** rejected as "explained by seasonality."
- Cross-check against `packages/core/GROUND_TRUTH.md` on screen.

## 2:10–2:35 - The loop acts + guardrails + compounding
- `pnpm activate` → audience (797 persuadables) → creative brief + 2 on-brand variants → **simulated sync to Braze** → measured **+10pp** lift.
- The guardrail **refuses a premium-SKU discount**, naming the rule (`pnpm fanout` output).
- `pnpm durable` → run 2 **skips the killed trap** from memory; **crash + resume** replays journaled steps.

## 2:35–3:00 - Optimize + reliability + close
- `pnpm bandit` → learns the best message **per segment**, +27.5% vs holdout, +19.6% vs "human marketing."
- Pan the **opportunity board** and the **`/how-it-works`** page.
- Close on the README architecture map + the OSS repo + "prototype vs GA: I built the vision, labeled what's simulated."

## One-line pitch
> *A transparent, warehouse-native Marketing Opportunity Engine that ranks by reach × value × uplift and proves each opportunity with a holdout - differentiating on causal credibility and auditability, not more automation.*
