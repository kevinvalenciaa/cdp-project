/**
 * Verifies that every planted signal in GROUND_TRUTH.md is actually recoverable
 * from the seeded warehouse. This is the Phase 0 acceptance gate.
 *
 * Run: `pnpm ground-truth`  (after `pnpm seed`)
 */
import { config } from "../shared/env.js";
import { Db, num } from "../shared/db.js";
import { archetype2Churn, campaignStats, guardrailStats, seasonalityInflation, underservedStats } from "./ground-truth-doc.js";

interface Check {
  name: string;
  pass: boolean;
  detail: string;
}

const checks: Check[] = [];
function check(name: string, pass: boolean, detail: string): void {
  checks.push({ name, pass, detail });
}

async function main(): Promise<void> {
  const db = await Db.open(config.duckdbPath);

  const nCustomers = num(await db.scalar("SELECT count(*) FROM customers"));
  const nOrders = num(await db.scalar("SELECT count(*) FROM orders"));
  const nSends = num(await db.scalar("SELECT count(*) FROM campaign_sends"));
  check("row counts", nCustomers >= 4900 && nOrders > 5000 && nSends > 2000, `customers=${nCustomers} orders=${nOrders} sends=${nSends}`);

  const stats = await campaignStats(db);
  const second = stats.get("SECOND_PURCHASE_SMS");
  check("genuine opportunity (SECOND_PURCHASE_SMS) shows real lift", !!second && second.lift > 0.035 && second.lift < 0.085, `lift=${(num(second?.lift) * 100).toFixed(1)}pp`);

  // The trap's defining property is "high raw conversion, NOT-significant incremental lift"
  // (the significance test is Phase 1). Here we assert the empirical lift stays small.
  const trap = stats.get("VIP_LOYALTY_BLAST");
  check("trap (VIP_LOYALTY_BLAST) has ~0 incremental lift despite high conversion", !!trap && Math.abs(trap.lift) < 0.05 && trap.rate_treat > 0.3, `rawConv=${(num(trap?.rate_treat) * 100).toFixed(1)}% lift=${(num(trap?.lift) * 100).toFixed(1)}pp`);

  const cross = stats.get("CROSS_CATEGORY_SMS");
  check("cross-sell (CROSS_CATEGORY_SMS) shows real lift", !!cross && cross.lift > 0.02 && cross.lift < 0.065, `lift=${(num(cross?.lift) * 100).toFixed(1)}pp`);

  const near = stats.get("RETARGET_NEAR_MISS");
  check("near-miss (RETARGET_NEAR_MISS) lift is small/insignificant", !!near && Math.abs(near.lift) < 0.04, `lift=${(num(near?.lift) * 100).toFixed(1)}pp`);

  const drop = stats.get("SPRING_DROP_CREATIVE");
  const ever = stats.get("SPRING_EVERGREEN_CREATIVE");
  check("archetype 1: product-drop creative beats evergreen", !!drop && !!ever && drop.rate_treat > ever.rate_treat, `drop=${(num(drop?.rate_treat) * 100).toFixed(1)}% evergreen=${(num(ever?.rate_treat) * 100).toFixed(1)}%`);

  const churn = await archetype2Churn(db);
  check("archetype 2: multi-category buyers churn less", churn.multi < churn.single, `multi=${(churn.multi * 100).toFixed(1)}% single=${(churn.single * 100).toFixed(1)}%`);

  const under = await underservedStats(db);
  check("archetype 3: underserved new-workwear cohort exists & is barely targeted", under.size >= 100 && under.sendCoverage < 0.2, `size=${under.size} sendCoverage=${(under.sendCoverage * 100).toFixed(1)}%`);

  const seasonal = await seasonalityInflation(db);
  check("seasonality false-positive: Q4 inflation present", seasonal > 0.2, `q4Inflation=${(seasonal * 100).toFixed(1)}%`);

  const guard = await guardrailStats(db);
  check("guardrail bait: premium never-discount SKUs exist", guard.count > 0, `count=${guard.count} e.g. ${guard.example}`);

  db.close();

  console.log("\nGround-truth verification:");
  let allPass = true;
  for (const c of checks) {
    console.log(`  ${c.pass ? "PASS" : "FAIL"}  ${c.name}  [${c.detail}]`);
    if (!c.pass) allPass = false;
  }
  console.log(allPass ? "\n✅ All planted signals recovered.\n" : "\n❌ Some planted signals are missing — fix the generator.\n");
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
