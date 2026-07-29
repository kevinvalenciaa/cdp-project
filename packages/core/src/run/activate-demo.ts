/**
 * Phase 6: draft work + AMP-analog + simulated activation (closing the flywheel).
 * Takes the top VERIFIED opportunity → compiles an audience → drafts a brief + variants →
 * guardrail-checks them → (simulated) syncs to a destination → measures the lift with a
 * holdout → writes the verified outcome to memory.
 *
 * Run: `pnpm --filter @lift/core activate`
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "../shared/env.js";
import { activateOpportunity } from "../activation/activate.js";

async function main(): Promise<void> {
  const runId = "p6-activate";
  const r = await activateOpportunity(runId);

  console.log(`\n=== Phase 6: activate "${r.opportunity.title}" (verified +${r.opportunity.upliftPp?.toFixed(1)}pp) ===\n`);
  console.log(`AUDIENCE: ${r.audience.label}`);
  console.log(`  reach=${r.audience.reach}  persuadable=${r.audience.persuadableReach} (${r.audience.persuadableSql})  channel=${r.audience.channel}`);
  console.log(`  sample member ids: ${r.audience.sampleMembers.join(", ")}`);

  console.log(`\nCREATIVE BRIEF (Agentic CDP draft work):\n${r.brief.split("\n").map((l) => `  ${l}`).join("\n")}`);

  console.log(`\nMESSAGE VARIANTS (AMP-analog):`);
  for (const v of r.variants) console.log(`  [${v.id}] ${v.text}`);

  console.log(`\nGUARDRAIL: ${r.guardrail.allowed ? "✅ all variants clear" : "🛑 blocked"}`);

  if (r.sync) {
    console.log(`\nACTIVATION (simulated): synced ${r.sync.membersSynced} members → ${r.sync.destination}`);
    console.log(`  artifact: ${r.sync.artifactPath}`);
  }

  const m = r.measurement;
  console.log(`\nMEASURED OUTCOME (holdout): treatment ${m.treatmentConv}/${m.treatmentN} vs control ${m.controlConv}/${m.controlN}`);
  console.log(`  → +${m.upliftPp.toFixed(1)}pp lift, CI [${m.ci[0].toFixed(1)}, ${m.ci[1].toFixed(1)}], p=${m.pValue.toFixed(3)} → ${m.verdict}`);
  console.log(`  outcome written to memory: ${r.memoryWritten ? "yes" : "no"}`);

  // Phase 6 gate
  const checks: [string, boolean][] = [
    ["only a VERIFIED opportunity was activated", r.opportunity.accepted === true],
    ["concrete audience with reach + persuadable count", r.audience.reach > 0 && r.audience.persuadableReach > 0],
    ["creative brief + >=2 message variants drafted", r.brief.length > 0 && r.variants.length >= 2],
    ["variants pass the guardrail", r.guardrail.allowed],
    ["simulated sync produced an activation artifact", r.sync !== null],
    ["lift measured with a holdout + verdict", ["real_lift", "no_significant_lift"].includes(m.verdict)],
    ["verified outcome written to memory", r.memoryWritten],
  ];
  console.log("\n--- PHASE 6 GATE ---");
  for (const [name, ok] of checks) console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}`);

  const dir = resolve(REPO_ROOT, "runs", runId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, "run.json"), JSON.stringify(r, null, 2));
  console.log(`\n  cost $${r.costUsd.toFixed(4)}  ·  run.json → runs/${runId}/run.json\n`);
  process.exit(checks.every(([, ok]) => ok) ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
