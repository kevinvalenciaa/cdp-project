/**
 * P3 verification: drive runEngineStreaming and assert the event sequence.
 * Runs against the live warehouse + stats with every LLM stage pinned off
 * (static explorer, no contrast, no groundedness, no memory) → deterministic and $0.
 * Run: `pnpm --filter @lift/core stream:test`
 */
import { runEngineStreaming, type EngineStreamEvent } from "../engine/engine-streaming.js";

async function main(): Promise<void> {
  const events: EngineStreamEvent[] = [];
  const result = await runEngineStreaming(
    "Grow second purchases from one-time buyers",
    (e) => {
      events.push(e);
      if (e.kind === "candidate_verified") {
        console.log(`  verified: ${e.opportunity.key} → ${e.opportunity.verdict}${e.opportunity.accepted ? " (accepted)" : ""}`);
      } else if (e.kind === "run_started") {
        console.log(`[run_started] ${e.candidateCount} candidates`);
      }
    },
    { withBareLlmContrast: false, withGroundedness: false, explorerMode: "static" },
  );

  const kinds = events.map((e) => e.kind);
  const vip = events.find((e) => e.kind === "candidate_verified" && e.opportunity.key === "VIP_LOYALTY_BLAST") as
    | Extract<EngineStreamEvent, { kind: "candidate_verified" }>
    | undefined;
  const hypothesisCount = kinds.filter((k) => k === "hypothesis_proposed").length;

  const checks: [string, boolean][] = [
    ["run_started is first", kinds[0] === "run_started"],
    ["run_finished is last", kinds[kinds.length - 1] === "run_finished"],
    ["explorer_started precedes the first candidate_started", kinds.indexOf("explorer_started") !== -1 && kinds.indexOf("explorer_started") < kinds.indexOf("candidate_started")],
    ["one hypothesis per probe (static explorer)", hypothesisCount >= 6],
    ["prioritizing precedes run_finished", kinds.indexOf("prioritizing") !== -1 && kinds.indexOf("prioritizing") < kinds.indexOf("run_finished")],
    ["no memory_hit (memory off)", !kinds.includes("memory_hit")],
    ["verified at least 6 candidates", kinds.filter((k) => k === "candidate_verified").length >= 6],
    ["VIP trap verified as no_significant_lift", vip?.opportunity.verdict === "no_significant_lift"],
    ["ranked has accepted opportunities", result.ranked.length > 0],
    ["every opportunity carries query provenance", [...result.ranked, ...result.rejected].every((o) => o.provenance.queries.length > 0)],
  ];
  console.log("\n--- P3 stream gate ---");
  let ok = true;
  for (const [name, pass] of checks) {
    console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}`);
    if (!pass) ok = false;
  }
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
