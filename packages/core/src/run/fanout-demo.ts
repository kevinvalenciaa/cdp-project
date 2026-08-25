/**
 * Phase 4: Haiku fan-out classifier + composable-context guardrails.
 *
 * Classifies many ad creatives with parallel cheap-model calls (no vector store), and
 * shows the guardrail layer suppressing a premium-SKU discount by naming the rule.
 * Run: `pnpm --filter @lift/core fanout`
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT, config } from "../shared/env.js";
import { newClient } from "../harness/loop.js";
import { generateCreatives } from "../engine/creatives.js";
import { fanoutClassify } from "../engine/fanout.js";
import { CostLedger } from "../shared/cost.js";
import { checkAction, listRules } from "../guardrails/guard.js";

async function main(): Promise<void> {
  const client = newClient();

  // --- Fan-out classification ---
  const creatives = generateCreatives(config.seed, 9);
  console.log(`\n=== Phase 4: Haiku fan-out over ${creatives.length} creatives (concurrency 8) ===`);
  const fan = await fanoutClassify(client, creatives, 8);
  console.log(`  classified ${fan.classifications.length} creatives`);
  console.log(`  wall time ${fan.wallMs}ms vs ${fan.avgCallMs}ms avg/call × ${fan.classifications.length} ` + `(≈${Math.round((fan.avgCallMs * fan.classifications.length) / fan.wallMs)}× speedup from parallelism)`);
  console.log(`  cost $${fan.costUsd.toFixed(4)} on ${config.models.fanout} (no embeddings / vector store)`);
  console.log(`  classifier agreement with intended style: ${(fan.agreement * 100).toFixed(0)}%`);
  console.log(`  style distribution: ${JSON.stringify(fan.styleCounts)}; discount-led share ${(fan.discountLedShare * 100).toFixed(0)}%`);

  // --- Guardrails ---
  console.log(`\n=== Composable-context guardrails (${listRules().length} rules) ===`);
  const ledger = new CostLedger();
  const actions = [
    "Launch a 20% off flash sale on the Fall Flagship premium outerwear collection to drive urgency.",
    "Send a friendly second-purchase SMS reminder to one-time buyers, 30 days after their first order.",
  ];
  const results = [];
  for (const a of actions) {
    const r = await checkAction(client, a, ledger);
    results.push({ action: a, ...r });
    console.log(`  ${r.allowed ? "✅ ALLOW " : "🛑 BLOCK "} ${a}`);
    if (!r.allowed) console.log(`           rule: ${r.violatedRule ?? "?"} - ${r.reason}`);
  }

  // --- Phase 4 gate ---
  const premium = results[0]!;
  const checks: [string, boolean][] = [
    ["classified all creatives in parallel with cost/latency", fan.classifications.length === creatives.length && fan.wallMs < fan.avgCallMs * fan.classifications.length],
    ["fan-out is reasonably accurate (no vector store)", fan.agreement >= 0.7],
    ["guardrail blocks the premium-SKU discount, naming the rule", !premium.allowed && (premium.violatedRule?.includes("premium") ?? false)],
    ["non-violating action is allowed", results[1]!.allowed],
  ];
  console.log("\n--- PHASE 4 GATE ---");
  for (const [name, ok] of checks) console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}`);
  const allPass = checks.every(([, ok]) => ok);

  const dir = resolve(REPO_ROOT, "runs", "fanout");
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, "run.json"), JSON.stringify({ fanout: fan, guardrails: results }, null, 2));
  console.log(`\n  guardrail cost $${ledger.totalUsd().toFixed(4)}  ·  run.json → runs/fanout/run.json\n`);
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
