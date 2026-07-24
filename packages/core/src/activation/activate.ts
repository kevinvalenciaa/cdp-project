import { config } from "../shared/env.js";
import { CostLedger } from "../shared/cost.js";
import { callMcpTool, connectStats, connectWarehouse } from "../harness/mcp-client.js";
import { newClient } from "../harness/loop.js";
import { runEngine } from "../engine/engine.js";
import type { Opportunity } from "../engine/types.js";
import { Memory } from "../memory/store.js";
import { checkAction, type GuardResult } from "../guardrails/guard.js";
import { simulateActivationOutcome } from "../outcomes/simulator.js";
import { compileAudience, type AudienceDef } from "./audience.js";
import { draftCreativeBrief, draftVariants } from "./creative.js";
import { syncToDestination, type SyncResult, type Variant } from "./connectors.js";

export interface ActivationResult {
  opportunity: Opportunity;
  audience: AudienceDef;
  brief: string;
  variants: Variant[];
  guardrail: { allowed: boolean; details: GuardResult[] };
  sync: SyncResult | null;
  measurement: {
    treatmentN: number;
    controlN: number;
    treatmentConv: number;
    controlConv: number;
    upliftPp: number;
    ci: [number, number];
    pValue: number;
    verdict: string;
    reason: string;
  };
  memoryWritten: boolean;
  costUsd: number;
}

/** Close the loop on a VERIFIED opportunity: draft → AMP assets → (simulated) activate → measure → remember. */
export async function activateOpportunity(runId: string, preferKey = "SECOND_PURCHASE_SMS"): Promise<ActivationResult> {
  const engine = await runEngine();
  const opp = engine.ranked.find((o) => o.key === preferKey) ?? engine.ranked[0];
  if (!opp) throw new Error("no accepted (verified) opportunity available to activate");

  const wh = await connectWarehouse();
  const stats = await connectStats();
  const client = newClient();
  const ledger = new CostLedger();

  // 1. Concrete audience (reach + persuadable sub-segment).
  const audience = await compileAudience(wh, opp.key);

  // 2. Agentic-CDP draft work + AMP-analog assets.
  const brief = await draftCreativeBrief(client, ledger, opp, audience);
  const variants = await draftVariants(client, ledger, brief, audience.channel, 2);

  // 3. Guardrail the drafts before any activation.
  const details = await Promise.all(variants.map((v) => checkAction(client, `${audience.channel} message: ${v.text}`, ledger)));
  const guardrail = { allowed: details.every((g) => g.allowed), details };

  // 4. Simulated activation (only if guardrail-clean).
  const sync = guardrail.allowed ? syncToDestination(runId, audience, brief, variants) : null;

  // 5. Simulated outcome + holdout measurement. We targeted the PERSUADABLE sub-segment
  // (e.g., SMS-responders), who by definition respond better than the broad average — so
  // their treatment rate is modestly higher than the original experiment's.
  const ev = opp.evidence as { conv_t: number; n_t: number; conv_c: number; n_c: number };
  const baseT = ev.n_t ? ev.conv_t / ev.n_t : 0.12;
  const trueT = Math.min(0.6, baseT * 1.3);
  const trueC = ev.n_c ? ev.conv_c / ev.n_c : 0.08;
  const out = simulateActivationOutcome(config.seed, audience.persuadableReach, trueT, trueC);
  const test = JSON.parse(
    (await callMcpTool(stats, "verify_lift_claim", { conv_t: out.treatmentConv, n_t: out.treatmentN, conv_c: out.controlConv, n_c: out.controlN })).text,
  );
  const measurement = {
    treatmentN: out.treatmentN,
    controlN: out.controlN,
    treatmentConv: out.treatmentConv,
    controlConv: out.controlConv,
    upliftPp: test.abs_lift * 100,
    ci: (test.ci95 as number[]).map((x) => x * 100) as [number, number],
    pValue: test.p_value,
    verdict: String(test.verdict),
    reason: String(test.reason),
  };

  // 6. Write the verified outcome to memory (closes the flywheel feedback).
  const memory = await Memory.open();
  let memoryWritten = false;
  try {
    await memory.write({
      runId,
      subject: opp.key,
      subjectType: "campaign",
      claim: `Activated ${opp.title}: measured +${measurement.upliftPp.toFixed(1)}pp (${measurement.verdict}) on ${audience.persuadableReach} persuadables`,
      verdict: measurement.verdict,
      // Traceable memory: the outcome numbers plus the run + the query fingerprints that
      // justified activating this opportunity in the first place.
      evidence: JSON.stringify({ ...out, runIds: [runId], fingerprints: opp.provenance?.queries.map((q) => q.fingerprint) ?? [] }),
      confidence: 0.92,
    });
    memoryWritten = true;
  } catch {
    /* gate / supersede */
  }
  memory.close();

  await wh.close();
  await stats.close();
  return { opportunity: opp, audience, brief, variants, guardrail, sync, measurement, memoryWritten, costUsd: ledger.totalUsd() };
}
