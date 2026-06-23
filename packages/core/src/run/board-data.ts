/**
 * Generates the consolidated board.json the UI renders: ranked opportunities + the
 * bare-LLM contrast, the activated opportunity's draft work + measured outcome, and the
 * bandit results. Run: `pnpm --filter @lift/core board:data`
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { REPO_ROOT, config } from "../shared/env.js";
import { runEngine } from "../engine/engine.js";
import { activateOpportunity } from "../activation/activate.js";
import { runBandit } from "../decisioning/bandit.js";

async function main(): Promise<void> {
  console.log("[board] running engine (with bare-LLM contrast) …");
  const opportunities = await runEngine({ withBareLlmContrast: true });
  console.log("[board] activating the top verified opportunity …");
  const activation = await activateOpportunity("board");
  console.log("[board] running the AI-Decisioning bandit …");
  const bandit = runBandit(config.seed);

  const board = {
    generatedAtSeed: config.seed,
    goal: opportunities.goal,
    opportunities,
    activation,
    bandit,
  };

  for (const out of [resolve(REPO_ROOT, "runs/board/board.json"), resolve(REPO_ROOT, "apps/ui/public/board.json")]) {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(board, null, 2));
    console.log(`[board] wrote ${out}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
