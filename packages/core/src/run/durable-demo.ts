/**
 * Phase 5: compounding memory + durable execution.
 *  - RUN 1 writes verified insights to memory.
 *  - RUN 2 skips the killed trap (and other dead-ends) using memory — no re-litigation.
 *  - CRASH + RESUME proves the journal survives a crash and steps are not re-run.
 *  - The verified-only write gate blocks an unverified claim (anti memory-poisoning).
 *
 * Run: `pnpm --filter @lift/core durable` (no API key needed — pure verification)
 */
import { rmSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "../shared/env.js";
import { Memory, MemoryPoisoningError } from "../memory/store.js";
import { durableRun } from "../durable/durable-run.js";
import { CrashError } from "../durable/journal.js";

function clearJournal(runId: string): void {
  rmSync(resolve(REPO_ROOT, "runs", runId), { recursive: true, force: true });
}

async function main(): Promise<void> {
  // Reset state for a clean demo.
  const mem = await Memory.open();
  await mem.clear();
  mem.close();
  for (const r of ["p5-run1", "p5-run2", "p5-crash"]) clearJournal(r);

  console.log("\n=== Phase 5: compounding memory + durable execution ===");

  // RUN 1 — fresh, writes verified insights.
  const r1 = await durableRun("p5-run1");
  console.log(`\nRUN 1 (fresh): verified ${r1.executedThisRun} candidates, wrote ${r1.insightsWritten} verified insights to memory.`);
  console.log(`  accepted: ${r1.opportunities.filter((o) => o.accepted).map((o) => o.title).join(", ") || "(none)"}`);

  // RUN 2 — consults memory, skips known dead-ends (incl. the trap).
  const r2 = await durableRun("p5-run2");
  console.log(`\nRUN 2 (memory has ${r2.priorInsightCount} insights):`);
  for (const s of r2.skippedFromMemory) console.log(`  ⏭️  skipped ${s.subject} — ${s.claim}`);
  for (const s of r2.revalidated) console.log(`  ♻️  revalidated ${s.subject} (stale dead-end re-verified, still holds) — ${s.claim}`);
  console.log(`  re-verified ${r2.executedThisRun}; skipped ${r2.skippedFromMemory.length} known dead-ends without re-litigating.`);

  // CRASH + RESUME — durability isolated from memory (noMemory) for a clean journal demo.
  clearJournal("p5-crash");
  let crashed = false;
  try {
    await durableRun("p5-crash", { crashAfter: 3, noMemory: true });
  } catch (e) {
    if (e instanceof CrashError) {
      crashed = true;
      console.log(`\n💥 CRASH: ${e.message} — journal persisted to disk.`);
    } else throw e;
  }
  const resume = await durableRun("p5-crash", { noMemory: true });
  console.log(
    `🔄 RESUME: replayed ${resume.resumedSteps.length} journaled steps (not re-run), executed ${resume.executedThisRun} more → finished with ${resume.opportunities.length} opportunities.`,
  );

  // VERIFIED-ONLY WRITE GATE — block an unverified claim.
  const mem3 = await Memory.open();
  let blocked = false;
  try {
    await mem3.write({ runId: "x", subject: "FAKE", subjectType: "campaign", claim: "unverified hunch", verdict: "unverified", evidence: "", confidence: 0.5 });
  } catch (e) {
    if (e instanceof MemoryPoisoningError) {
      blocked = true;
      console.log(`\n🛡️  GATE: ${e.message}`);
    }
  }
  mem3.close();

  // Phase 5 gate
  const skippedTrap = r2.skippedFromMemory.some((s) => s.subject === "VIP_LOYALTY_BLAST");
  const checks: [string, boolean][] = [
    ["run 1 wrote verified insights to memory", r1.insightsWritten > 0],
    ["run 2 skipped the killed trap (VIP) using memory", skippedTrap],
    ["crash + resume replayed journaled steps and finished", crashed && resume.resumedSteps.length >= 3 && resume.executedThisRun > 0],
    ["verified-only gate blocked an unverified write", blocked],
  ];
  console.log("\n--- PHASE 5 GATE ---");
  for (const [name, ok] of checks) console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}`);
  console.log("");
  process.exit(checks.every(([, ok]) => ok) ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
