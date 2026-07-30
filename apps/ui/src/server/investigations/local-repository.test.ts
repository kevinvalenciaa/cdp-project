import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import boardData from "../../../public/board.json";
import type { InvestigationContextV1, RequestContext } from "@/lib/investigations";
import type { ActivationResult, RunDetail } from "@/lib/types";

const temp = mkdtempSync(join(tmpdir(), "lift-investigations-"));
const statePath = join(temp, "state.json");
let Repository: typeof import("./local-repository").LocalInvestigationRepository;
let ctx: RequestContext;

beforeAll(async () => {
  process.env.LIFT_INVESTIGATION_STATE_PATH = statePath;
  vi.resetModules();
  ({ LocalInvestigationRepository: Repository } = await import("./local-repository"));
  ctx = {
    userId: "00000000-0000-4000-8000-000000000002",
    workspaceId: "00000000-0000-4000-8000-000000000001",
    role: "owner",
    email: "owner@example.com",
  };
});

afterAll(() => {
  delete process.env.LIFT_INVESTIGATION_STATE_PATH;
  rmSync(temp, { recursive: true, force: true });
});

describe("LocalInvestigationRepository", () => {
  it("persists a chat, atomically promotes completed results, and deduplicates current truth", async () => {
    const repository = new Repository();
    const created = await repository.createInvestigation(ctx, {
      content: "Find repeat-purchase opportunities",
      clientMessageId: "repo-test-message-1",
      intentHint: "investigate",
    });
    const input = created.messages[0]!;
    const context: InvestigationContextV1 = {
      version: 1,
      objective: created.objective,
      currentPrompt: input.content,
      recentMessages: [{ role: "user", content: input.content }],
      scopedResults: [],
      referencedOccurrenceIds: [],
      workspaceInsights: [],
    };
    const assistantJob = await repository.claimJob("assistant", "repo-test-assistant", 60);
    expect(assistantJob?.messageId).toBe(input.id);
    await repository.completeJob(assistantJob!.id);
    const run = await repository.enqueueRun(input.id, context, input.content);
    const engineJob = await repository.claimJob("engine", "repo-test-engine", 60);
    expect(engineJob?.runId).toBe(run.id);
    await repository.markRunRunning(run.id);
    await repository.completeRun(run.id, boardData as unknown as RunDetail);

    const completed = await repository.getInvestigation(ctx, created.id);
    expect(completed?.runs[0]?.status).toBe("completed");
    expect(completed?.results.filter((result) => result.accepted)).toHaveLength(3);

    const global = await repository.listOpportunities(ctx, { status: "proven" });
    expect(global).toHaveLength(3);
    expect(global[0]?.current.sourceInvestigationTitle).toBe(created.title);
  });

  it("routes duplicate client message IDs idempotently and preserves answer citations", async () => {
    const repository = new Repository();
    const investigation = (await repository.listInvestigations(ctx, { query: "repeat-purchase" }))[0]!;
    const first = await repository.enqueueMessage(ctx, investigation.id, {
      content: "Explain the highest impact result",
      clientMessageId: "repo-test-answer-1",
      intentHint: "answer",
    });
    const duplicate = await repository.enqueueMessage(ctx, investigation.id, {
      content: "Explain the highest impact result",
      clientMessageId: "repo-test-answer-1",
      intentHint: "answer",
    });
    expect(duplicate.id).toBe(first.id);
    const assistantJob = await repository.claimJob("assistant", "repo-test-answer-assistant", 60);
    expect(assistantJob?.messageId).toBe(first.id);
    await repository.completeJob(assistantJob!.id);
    const result = (await repository.getScopedResults(investigation.id))[0]!;
    await repository.completeAnswer(first.id, "Grounded answer", [result.id]);
    const detail = await repository.getInvestigation(ctx, investigation.id);
    expect(detail?.messages.at(-1)?.citations).toEqual([result.id]);
  });

  it("keeps superseded history and rejects activation from an obsolete occurrence", async () => {
    const repository = new Repository();
    const investigation = (await repository.listInvestigations(ctx, { query: "repeat-purchase" }))[0]!;
    const prior = (await repository.getScopedResults(investigation.id)).find(
      (result) => result.opportunityKey === boardData.opportunities.ranked[0]!.key,
    )!;
    const input = await repository.enqueueMessage(ctx, investigation.id, {
      content: "Reverify the leading opportunity",
      clientMessageId: "repo-test-supersession-1",
      intentHint: "investigate",
    });
    const assistantJob = await repository.claimJob("assistant", "repo-test-supersession-assistant", 60);
    await repository.completeJob(assistantJob!.id);
    const run = await repository.enqueueRun(
      input.id,
      {
        version: 1,
        objective: investigation.objective,
        currentPrompt: input.content,
        recentMessages: [{ role: "user", content: input.content }],
        scopedResults: [],
        referencedOccurrenceIds: [prior.id],
        workspaceInsights: [],
      },
      input.content,
    );
    const engineJob = await repository.claimJob("engine", "repo-test-supersession-engine", 60);
    expect(engineJob?.runId).toBe(run.id);
    await repository.markRunRunning(run.id);
    const rejected = structuredClone(boardData) as unknown as RunDetail;
    const demoted = { ...rejected.opportunities.ranked[0]!, accepted: false, score: 0, verdict: "no_significant_lift" as const };
    rejected.opportunities.ranked = rejected.opportunities.ranked.slice(1);
    rejected.opportunities.rejected = [demoted, ...rejected.opportunities.rejected];
    await repository.completeRun(run.id, rejected);

    const current = await repository.getWorkspaceOpportunity(ctx, prior.opportunityKey);
    expect(current?.opportunity.status).toBe("superseded");
    expect(current?.history.length).toBeGreaterThanOrEqual(2);
    expect(current?.history.find((occurrence) => occurrence.id === prior.id)?.supersededByOccurrenceId).toBe(
      current?.history[0]?.id,
    );
    await expect(
      repository.recordActivation(ctx, prior.id, boardData.activation as unknown as ActivationResult),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("creates immutable revocable share records without storing the raw token", async () => {
    const repository = new Repository();
    const investigation = (await repository.listInvestigations(ctx, { query: "repeat-purchase" }))[0]!;
    const share = await repository.createShare(ctx, investigation.id, {
      tokenHash: "hashed-token-only",
      expiresAt: null,
      snapshot: {
        version: 1,
        investigationId: investigation.id,
        title: investigation.title,
        objective: investigation.objective,
        asOf: new Date().toISOString(),
        scope: "proven",
        opportunities: [],
      },
    });
    expect((await repository.getShareByHash("hashed-token-only"))?.snapshot.title).toBe(investigation.title);
    expect(await repository.revokeShare(ctx, share.id)).toBe(true);
    expect((await repository.getShareByHash("hashed-token-only"))?.revokedAt).not.toBeNull();
  });

  it("finalizes a cancellation requested while an engine run is active", async () => {
    const repository = new Repository();
    const created = await repository.createInvestigation(ctx, {
      content: "Cancellation integration investigation",
      clientMessageId: "repo-test-cancellation-1",
      intentHint: "investigate",
    });
    const input = created.messages[0]!;
    const assistantJob = await repository.claimJob("assistant", "repo-test-cancel-assistant", 60);
    expect(assistantJob?.messageId).toBe(input.id);
    await repository.completeJob(assistantJob!.id);
    const run = await repository.enqueueRun(
      input.id,
      {
        version: 1,
        objective: created.objective,
        currentPrompt: input.content,
        recentMessages: [{ role: "user", content: input.content }],
        scopedResults: [],
        referencedOccurrenceIds: [],
        workspaceInsights: [],
      },
      input.content,
    );
    const engineJob = await repository.claimJob("engine", "repo-test-cancel-engine", 60);
    expect(engineJob?.runId).toBe(run.id);
    await repository.markRunRunning(run.id);
    expect((await repository.cancelRun(ctx, run.id))?.cancelRequested).toBe(true);
    expect((await repository.getRun(run.id))?.status).toBe("running");

    await repository.finalizeRunCancellation(run.id);

    expect((await repository.getRun(run.id))?.status).toBe("cancelled");
    const detail = await repository.getInvestigation(ctx, created.id);
    expect(detail?.messages.find((message) => message.id === run.assistantMessageId)?.status).toBe("cancelled");
    expect((await repository.listEvents(ctx, created.id, 0)).at(-1)?.event.kind).toBe("run_cancelled");
    await repository.completeJob(engineJob!.id);
  });

  it("recovers an expired lease without letting two workers own it at once", async () => {
    const repository = new Repository();
    const created = await repository.createInvestigation(ctx, {
      content: "Lease recovery investigation",
      clientMessageId: "repo-test-lease-1",
      intentHint: "investigate",
    });
    const firstLease = await repository.claimJob("assistant", "crashed-worker", -1);
    expect(firstLease?.messageId).toBe(created.messages[0]?.id);
    const recoveredLease = await repository.claimJob("assistant", "recovery-worker", 60);
    expect(recoveredLease?.id).toBe(firstLease?.id);
    expect(recoveredLease?.attempts).toBe(2);
    expect(await repository.claimJob("assistant", "competing-worker", 60)).toBeNull();
    await repository.completeJob(recoveredLease!.id);
  });

  it("uses stable cursor pagination for investigations and canonical opportunities", async () => {
    const repository = new Repository();
    const firstInvestigations = await repository.listInvestigations(ctx, { limit: 1 });
    expect(firstInvestigations).toHaveLength(1);
    const firstInvestigation = firstInvestigations[0]!;
    const secondInvestigations = await repository.listInvestigations(ctx, {
      cursor: {
        lastActivityAt: firstInvestigation.lastActivityAt,
        id: firstInvestigation.id,
      },
      limit: 1,
    });
    expect(secondInvestigations[0]?.id).not.toBe(firstInvestigation.id);

    const firstOpportunities = await repository.listOpportunities(ctx, {
      status: "all",
      limit: 1,
    });
    expect(firstOpportunities).toHaveLength(1);
    const firstOpportunity = firstOpportunities[0]!;
    const secondOpportunities = await repository.listOpportunities(ctx, {
      status: "all",
      cursor: {
        impactMonthly: firstOpportunity.current.impactMonthly,
        key: firstOpportunity.key,
      },
      limit: 1,
    });
    expect(secondOpportunities[0]?.key).not.toBe(firstOpportunity.key);
  });
});
