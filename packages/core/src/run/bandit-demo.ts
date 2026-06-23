/**
 * Phase 7: AI-Decisioning bandit slice. A contextual Thompson-sampling bandit learns the
 * best message variant PER SEGMENT and beats both a random holdout and a naive
 * best-on-average ("human marketing") baseline. Kept separate from the harness.
 *
 * Run: `pnpm --filter @lift/core bandit` (no API key — pure simulation)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT, config } from "../shared/env.js";
import { SCENARIO, runBandit } from "../decisioning/bandit.js";

async function main(): Promise<void> {
  console.log(`\n=== Phase 7: AI-Decisioning bandit (Thompson sampling, ${SCENARIO.segments.length} segments × ${SCENARIO.variants.length} variants) ===`);
  console.log("  (separate module from the harness — RL/optimization over delivery)\n");

  const r = runBandit(config.seed);

  console.log("  learned best variant per segment vs the true optimum:");
  SCENARIO.segments.forEach((s, i) => {
    const ok = r.learnedBest[i] === r.oracleBest[i];
    console.log(`    ${s.name.padEnd(4)} → ${r.learnedBest[i]!.padEnd(16)} ${ok ? "✓" : `✗ (true: ${r.oracleBest[i]})`}`);
  });

  console.log(`\n  conversion rates over ${r.impressions} impressions:`);
  console.log(`    random holdout (no optimization): ${(r.randomRate * 100).toFixed(1)}%`);
  console.log(`    best-on-average ("human marketing", always "${r.globalBestVariant}"): ${(r.globalBestRate * 100).toFixed(1)}%`);
  console.log(`    bandit (personalized):            ${(r.banditRate * 100).toFixed(1)}%`);
  console.log(`    oracle (always optimal):          ${(r.oracleRate * 100).toFixed(1)}%`);
  console.log(`\n  lift vs holdout:        +${(r.liftVsHoldout * 100).toFixed(1)}%`);
  console.log(`  lift vs human marketing: +${(r.liftVsGlobalBest * 100).toFixed(1)}%`);

  const checks: [string, boolean][] = [
    ["bandit converged to the best variant per segment", r.converged],
    ["bandit beats the random holdout", r.liftVsHoldout > 0],
    ['bandit beats the best-on-average ("human marketing") baseline', r.liftVsGlobalBest > 0],
    ["reports incremental lift vs a holdout (AI-Decisioning discipline)", Number.isFinite(r.liftVsHoldout)],
  ];
  console.log("\n--- PHASE 7 GATE ---");
  for (const [name, ok] of checks) console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}`);

  const dir = resolve(REPO_ROOT, "runs", "bandit");
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, "run.json"), JSON.stringify(r, null, 2));
  console.log(`\n  run.json → runs/bandit/run.json\n`);
  process.exit(checks.every(([, ok]) => ok) ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
