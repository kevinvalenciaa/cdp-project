/**
 * Phase 3: the opportunity engine — Verifier-gated ranking + the bare-LLM contrast.
 *
 * Shows that ranking by VERIFIED incremental uplift (not raw conversion) demotes the
 * VIP trap and rejects the Q4 seasonality spike — and that a bare LLM (no statistics)
 * gets fooled by both. Run: `pnpm --filter @lift/core opportunities`
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "../shared/env.js";
import { runEngine } from "../engine/engine.js";
import type { Opportunity } from "../engine/types.js";

function fmt(o: Opportunity): string {
  const lift = o.upliftPp == null ? "—" : `${o.upliftPp >= 0 ? "+" : ""}${o.upliftPp.toFixed(1)}pp`;
  const ci = o.ci ? ` CI[${o.ci[0].toFixed(1)},${o.ci[1].toFixed(1)}]` : "";
  const p = o.pValue == null ? "" : ` p=${o.pValue.toFixed(3)}`;
  const raw = o.rawConversion == null ? "" : ` raw=${o.rawConversion.toFixed(1)}%`;
  return `${o.title}\n      reach=${o.reach} value=$${o.value.toFixed(0)}${raw} lift=${lift}${ci}${p}\n      → ${o.reason}`;
}

async function main(): Promise<void> {
  const result = await runEngine({ withBareLlmContrast: true });

  console.log(`\n=== Lift Compass — Opportunity Engine (seed ${result.generatedFromSeed}) ===`);
  console.log(`Goal: ${result.goal}\n`);

  console.log("RANKED OPPORTUNITIES (verified incremental lift):");
  result.ranked.forEach((o, i) => console.log(`  #${i + 1} [score ${o.score.toFixed(0)}] ${fmt(o)}`));

  console.log("\nDEMOTED / REJECTED (with reasons):");
  for (const o of result.rejected) console.log(`  ✗ [${o.verdict}] ${fmt(o)}`);

  console.log("\n--- BARE LLM vs VERIFIER (the contrast) ---");
  for (const o of [...result.ranked, ...result.rejected]) {
    if (!o.bareLlm || o.rawConversion == null) continue;
    const v = o.accepted ? "ACCEPT" : "REJECT";
    const b = o.bareLlm.accepted ? "ACCEPT" : "REJECT";
    const flag = v !== b ? "  ⚠️ DISAGREE" : "";
    console.log(`  ${o.title.padEnd(42)} verifier=${v}  bareLLM=${b}${flag}  (${o.bareLlm.reason})`);
  }

  // Phase 3 gate
  const vip = [...result.ranked, ...result.rejected].find((o) => o.key === "VIP_LOYALTY_BLAST");
  const second = result.ranked.find((o) => o.key === "SECOND_PURCHASE_SMS");
  const q4 = result.rejected.find((o) => o.key === "Q4_SURGE");
  const checks: [string, boolean][] = [
    ["genuine opportunity surfaces with lift + p-value", !!second && (second.upliftPp ?? 0) > 3 && (second.pValue ?? 1) < 0.05],
    ["VIP trap is demoted (not accepted, CI includes 0)", !!vip && !vip.accepted && !!vip.ci && vip.ci[0] <= 0 && vip.ci[1] >= 0],
    ["seasonality spike is rejected as not-a-real-change", !!q4 && q4.verdict === "explained_by_seasonality"],
    ["bare LLM accepts the trap that the verifier rejects", !!vip && vip.bareLlm?.accepted === true && vip.accepted === false],
  ];
  console.log("\n--- PHASE 3 GATE ---");
  for (const [name, ok] of checks) console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}`);
  const allPass = checks.every(([, ok]) => ok);

  const dir = resolve(REPO_ROOT, "runs", "opportunities");
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, "run.json"), JSON.stringify(result, null, 2));
  console.log(`\n  contrast cost: $${result.contrastUsd.toFixed(4)}  ·  run.json → runs/opportunities/run.json\n`);
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
