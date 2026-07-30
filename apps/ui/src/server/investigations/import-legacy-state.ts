import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { EngineEvent, RunDetail } from "@/lib/types";
import type { InvestigationContextV1, RequestContext } from "@/lib/investigations";
import { getInvestigationRepository } from "./index";
import { PostgresInvestigationRepository } from "./postgres-repository";

interface LegacyState {
  latestRun: RunDetail | null;
  latestActivity: EngineEvent[];
}

async function main(): Promise<void> {
  const path = resolve(
    process.cwd(),
    process.env.LEGACY_STATE_PATH || "../../runs/app-state.json",
  );
  if (!existsSync(path)) {
    console.log(`No legacy state exists at ${path}; nothing to import.`);
    return;
  }
  const legacy = JSON.parse(readFileSync(path, "utf8")) as LegacyState;
  if (!legacy.latestRun) {
    console.log("The legacy state has no completed run; nothing to import.");
    return;
  }
  const productionImport = Boolean(process.env.DATABASE_URL);
  if (
    productionImport
    && (!process.env.LEGACY_OWNER_USER_ID
      || !process.env.LEGACY_OWNER_EMAIL
      || !process.env.LEGACY_WORKSPACE_ID)
  ) {
    throw new Error(
      "Postgres legacy imports require LEGACY_OWNER_USER_ID, LEGACY_OWNER_EMAIL, and LEGACY_WORKSPACE_ID.",
    );
  }
  const repository = await getInvestigationRepository();
  const user = {
    id: process.env.LEGACY_OWNER_USER_ID || "00000000-0000-4000-8000-000000000002",
    email: process.env.LEGACY_OWNER_EMAIL || "maria@fashionretailer.com",
  };
  const ctx: RequestContext = await repository.resolveWorkspace(
    user,
    process.env.LEGACY_WORKSPACE_ID,
  );
  const existing = await repository.listInvestigations(ctx, {
    query: "Imported discovery run",
    limit: 1,
  });
  if (existing.some((item) => item.title === "Imported discovery run")) {
    console.log("Legacy state was already imported.");
    await close(repository);
    return;
  }

  const investigation = await repository.createInvestigation(ctx, {
    content: legacy.latestRun.goal,
    clientMessageId: "legacy-import-v1",
    intentHint: "investigate",
  });
  await repository.updateInvestigation(ctx, investigation.id, {
    title: "Imported discovery run",
  });
  const input = investigation.messages[0]!;
  const assistantJob = await repository.claimJob("assistant", "legacy-import", 60);
  if (assistantJob) await repository.completeJob(assistantJob.id);
  const context: InvestigationContextV1 = {
    version: 1,
    objective: legacy.latestRun.goal,
    currentPrompt: legacy.latestRun.goal,
    recentMessages: [{ role: "user", content: legacy.latestRun.goal }],
    scopedResults: [],
    referencedOccurrenceIds: [],
    workspaceInsights: [],
  };
  const run = await repository.enqueueRun(input.id, context, legacy.latestRun.goal);
  const engineJob = await repository.claimJob("engine", "legacy-import", 60);
  await repository.markRunRunning(run.id);
  for (let index = 0; index < legacy.latestActivity.length; index++) {
    const event = legacy.latestActivity[index]!;
    await repository.appendEngineEvent(run, event, `legacy:${index}:${event.kind}`);
  }
  await repository.completeRun(run.id, legacy.latestRun);
  if (engineJob) await repository.completeJob(engineJob.id);
  if (legacy.latestRun.activation) {
    const results = await repository.getScopedResults(investigation.id);
    const occurrence = results.find(
      (item) => item.opportunityKey === legacy.latestRun?.activation?.opportunity.key,
    );
    if (occurrence) await repository.recordActivation(ctx, occurrence.id, legacy.latestRun.activation);
  }
  console.log(`Imported legacy state into investigation ${investigation.id}.`);
  await close(repository);
}

async function close(repository: Awaited<ReturnType<typeof getInvestigationRepository>>): Promise<void> {
  if (repository instanceof PostgresInvestigationRepository) await repository.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
