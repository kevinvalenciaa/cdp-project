import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import boardData from "../../../public/board.json";
import type { InvestigationContextV1, RequestContext } from "@/lib/investigations";
import type { Opportunity, RunDetail } from "@/lib/types";
import { PostgresInvestigationRepository } from "./postgres-repository";

const databaseUrl = process.env.TEST_DATABASE_URL;
const userId = process.env.TEST_SUPABASE_USER_ID;
const workspaceId = process.env.TEST_SUPABASE_WORKSPACE_ID;
const enabled = Boolean(databaseUrl && userId && workspaceId);
const sql = databaseUrl ? postgres(databaseUrl, { max: 1 }) : null;

if (!enabled) {
  // Say so loudly. This is the *production* persistence path, and silently
  // skipping it made a green `pnpm test` look like it covered the repository
  // that actually ships. Every divergence between the two implementations found
  // in review - an unscoped read in cancelRun, a missing status guard in
  // markRunRunning, non-idempotent recordActivation, 403-vs-404 on revokeShare,
  // a limit clamp that killed pagination - lived in this file's blind spot.
  console.warn(
    "\n[skipped] PostgresInvestigationRepository integration tests.\n" +
      "  The production persistence path is NOT covered by this run.\n" +
      "  Set TEST_DATABASE_URL, TEST_SUPABASE_USER_ID and TEST_SUPABASE_WORKSPACE_ID to enable them.\n" +
      "  With a local stack: supabase start && supabase db reset, then use the connection string it prints\n" +
      "  and the ids in supabase/tests/integration_fixture.sql. See .env.example.\n",
  );
}

afterAll(async () => {
  await sql?.end();
});

describe.runIf(enabled)("PostgresInvestigationRepository", () => {
  it("persists an investigation and promotes a completed result transactionally", async () => {
    const repository = new PostgresInvestigationRepository(databaseUrl!);
    const ctx: RequestContext = {
      userId: userId!,
      workspaceId: workspaceId!,
      role: "owner",
      email: "integration@example.com",
    };
    const investigation = await repository.createInvestigation(ctx, {
      content: "Postgres integration investigation",
      clientMessageId: `integration-${Date.now()}`,
      intentHint: "investigate",
    });
    try {
      const input = investigation.messages[0]!;
      const assistantJob = await repository.claimJob("assistant", "integration-assistant", 60);
      expect(assistantJob?.messageId).toBe(input.id);
      expect(await repository.claimJob("assistant", "integration-assistant-2", 60)).toBeNull();
      await repository.completeJob(assistantJob!.id);
      const context: InvestigationContextV1 = {
        version: 1,
        objective: investigation.objective,
        currentPrompt: input.content,
        recentMessages: [{ role: "user", content: input.content }],
        scopedResults: [],
        referencedOccurrenceIds: [],
        workspaceInsights: [],
      };
      const run = await repository.enqueueRun(input.id, context, input.content);
      const engineJob = await repository.claimJob("engine", "integration-engine", 60);
      expect(engineJob?.runId).toBe(run.id);
      await repository.markRunRunning(run.id);
      await repository.completeRun(run.id, boardData as unknown as RunDetail);
      await repository.completeJob(engineJob!.id);

      const completed = await repository.getInvestigation(ctx, investigation.id);
      expect(completed?.runs[0]?.status).toBe("completed");
      expect(completed?.results).toHaveLength(8);
      expect((await repository.listOpportunities(ctx, { investigationId: investigation.id })).length).toBeGreaterThan(0);

      const followUp = await repository.enqueueMessage(ctx, investigation.id, {
        content: "Refresh the warehouse analysis",
        clientMessageId: `integration-follow-up-${Date.now()}`,
        intentHint: "investigate",
      });
      const duplicate = await repository.enqueueMessage(ctx, investigation.id, {
        content: "Refresh the warehouse analysis",
        clientMessageId: followUp.clientMessageId!,
        intentHint: "investigate",
      });
      expect(duplicate.id).toBe(followUp.id);
      const followUpAssistantJob = await repository.claimJob("assistant", "integration-assistant", 60);
      await repository.completeJob(followUpAssistantJob!.id);
      const secondRun = await repository.enqueueRun(followUp.id, context, followUp.content);
      const secondEngineJob = await repository.claimJob("engine", "integration-engine", 60);
      await repository.markRunRunning(secondRun.id);
      const checkpointEvent = {
        kind: "candidate_verified" as const,
        key: boardData.opportunities.ranked[0]!.key,
        title: boardData.opportunities.ranked[0]!.title,
        category: "found" as const,
        detail: boardData.opportunities.ranked[0]!.reason,
        opportunity: boardData.opportunities.ranked[0]! as unknown as Opportunity,
      };
      expect(await repository.appendEngineEvent(secondRun, checkpointEvent, "candidate:one")).not.toBeNull();
      expect(await repository.appendEngineEvent(secondRun, checkpointEvent, "candidate:one")).toBeNull();
      expect(await repository.getRunCheckpointEvents(secondRun.id)).toHaveLength(1);
      await repository.completeRun(secondRun.id, boardData as unknown as RunDetail);
      await repository.completeJob(secondEngineJob!.id);

      const terminalEvents = (await repository.listEvents(ctx, investigation.id, 0)).filter(
        (event) => event.event.kind === "run_finished",
      );
      expect(terminalEvents).toHaveLength(2);
      expect(
        (await repository.getWorkspaceOpportunity(ctx, boardData.opportunities.ranked[0]!.key))
          ?.opportunity.occurrenceCount,
      ).toBe(2);
    } finally {
      await sql!`delete from public.investigations where id = ${investigation.id}::uuid`;
      await repository.close();
    }
  });

  it("enforces one leased engine job across concurrent investigations", async () => {
    const repository = new PostgresInvestigationRepository(databaseUrl!);
    const ctx: RequestContext = {
      userId: userId!,
      workspaceId: workspaceId!,
      role: "owner",
      email: "integration@example.com",
    };
    const investigations = await Promise.all(
      ["Engine concurrency A", "Engine concurrency B"].map((content, index) =>
        repository.createInvestigation(ctx, {
          content,
          clientMessageId: `engine-concurrency-${index}-${Date.now()}`,
          intentHint: "investigate",
        }),
      ),
    );
    try {
      const pendingByMessage = new Map(
        investigations.map((investigation) => [investigation.messages[0]!.id, investigation]),
      );
      for (let index = 0; index < investigations.length; index++) {
        const assistantJob = await repository.claimJob("assistant", "engine-concurrency-assistant", 60);
        const investigation = pendingByMessage.get(assistantJob?.messageId ?? "");
        expect(investigation).toBeDefined();
        const input = investigation!.messages[0]!;
        await repository.completeJob(assistantJob!.id);
        await repository.enqueueRun(
          input.id,
          {
            version: 1,
            objective: investigation!.objective,
            currentPrompt: input.content,
            recentMessages: [{ role: "user", content: input.content }],
            scopedResults: [],
            referencedOccurrenceIds: [],
            workspaceInsights: [],
          },
          input.content,
        );
      }

      const first = await repository.claimJob("engine", "engine-concurrency-first", 60);
      expect(first).not.toBeNull();
      expect(await repository.claimJob("engine", "engine-concurrency-second", 60)).toBeNull();
      await repository.completeJob(first!.id);
      const second = await repository.claimJob("engine", "engine-concurrency-second", 60);
      expect(second).not.toBeNull();
      await repository.completeJob(second!.id);
    } finally {
      await sql!`
        delete from public.investigations
        where id in (${investigations[0]!.id}::uuid, ${investigations[1]!.id}::uuid)
      `;
      await repository.close();
    }
  });
});
