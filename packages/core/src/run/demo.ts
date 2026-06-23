/**
 * Phase 2 demo: run a single investigation and print the harness trace, proving the
 * Hightouch mechanics (initial plan, mid-run update_plan on a surprise, a buffered
 * payload, a subagent summary, plan regurgitation, and total_cost_usd).
 *
 * Run: `pnpm demo` (needs ANTHROPIC_API_KEY in .env)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "../shared/env.js";
import { Harness } from "../harness/harness.js";

const GOAL =
  process.argv.slice(2).join(" ").trim() ||
  "Our marketing team currently BELIEVES the VIP loyalty email campaign is our strongest driver of repeat " +
    "purchases (it has a ~42% conversion rate). Validate that assumption FIRST using holdout/lift evidence. " +
    "Then find the single most promising VERIFIED opportunity to grow second purchases from one-time buyers. " +
    "Spawn an investigator for at least one deep dive.";

function icon(kind: string): string {
  return (
    {
      plan_made: "📋",
      plan_updated: "🔄",
      step_executed: "✓",
      tool_call: "🔧",
      tool_buffered: "💾",
      subagent_spawned: "🧵",
      subagent_returned: "↩︎",
      assistant_text: "💬",
      finish: "🏁",
    }[kind] ?? "·"
  );
}

async function main(): Promise<void> {
  const harness = await Harness.create();
  console.log(`\n=== Lift Compass — harness run ${harness.runId} ===\nGoal: ${GOAL}\n`);

  const result = await harness.run(GOAL);
  await harness.close();

  console.log("--- TRACE ---");
  for (const e of result.trace) {
    const d = e.detail;
    let line = "";
    if (e.kind === "plan_made") line = `plan: ${(d.steps as string[]).length} steps`;
    else if (e.kind === "plan_updated") line = `reason: ${d.reason}`;
    else if (e.kind === "tool_call") line = `${d.name} (${d.bytes} chars${d.isError ? ", ERROR" : ""})`;
    else if (e.kind === "tool_buffered") line = `${d.name} → ${d.file} (${d.bytes} chars)`;
    else if (e.kind === "subagent_spawned") line = `${d.objective}`;
    else if (e.kind === "subagent_returned") line = `${String(d.summary).slice(0, 160)}`;
    else if (e.kind === "assistant_text") line = `${String(d.text).slice(0, 140)}`;
    else if (e.kind === "finish") line = `${String(d.summary).slice(0, 220)}`;
    console.log(`  ${String(e.t).padStart(6)}ms ${icon(e.kind)} ${e.kind.padEnd(18)} ${line}`);
  }

  console.log("\n--- FINAL PLAN ---");
  console.log(
    result.plan ? result.plan.steps.map((s) => `  ${s.id}. [${s.status}] ${s.description}`).join("\n") : "  (none)",
  );

  // Phase 2 gate checklist
  const has = (k: string) => result.trace.some((e) => e.kind === k);
  const checks: [string, boolean][] = [
    ["initial plan made", has("plan_made")],
    ["mid-run update_plan fired", result.planUpdates > 0],
    ["a large payload was buffered to scratchpad", has("tool_buffered")],
    ["a subagent returned a summary", has("subagent_returned")],
    ["finished with a verified opportunity", has("finish")],
  ];
  console.log("\n--- PHASE 2 GATE ---");
  for (const [name, ok] of checks) console.log(`  ${ok ? "PASS" : "----"}  ${name}`);
  console.log(`\n  total_cost_usd: $${result.costUsd.toFixed(4)}`);
  for (const [model, c] of Object.entries(result.costByModel)) {
    console.log(`    ${model}: ${c.calls} calls, ${c.inputTokens}+${c.outputTokens} tok, $${c.usd.toFixed(4)}`);
  }

  const dir = resolve(REPO_ROOT, "runs", harness.runId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, "run.json"), JSON.stringify(result, null, 2));
  console.log(`\n  run.json → runs/${harness.runId}/run.json\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
