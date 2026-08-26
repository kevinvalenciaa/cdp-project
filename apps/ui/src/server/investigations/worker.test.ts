import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { RequestContext } from "@/lib/investigations";

const temp = mkdtempSync(join(tmpdir(), "lift-worker-"));
let repository: import("./repository").InvestigationRepository;
let worker: typeof import("./worker");
let ctx: RequestContext;

beforeAll(async () => {
  process.env.LIFT_INVESTIGATION_STATE_PATH = join(temp, "state.json");
  process.env.LIFT_MODE = "demo";
  // Park the retry sweep beyond any test timeout. Cancellation has to be handled
  // as cancellation, not rescued a few seconds later by a retry of a job that was
  // wrongly booked as failed - which is what the original code did.
  process.env.WORKER_RETRY_SWEEP_MS = "600000";
  delete process.env.DATABASE_URL;
  vi.resetModules();
  const { getInvestigationRepository } = await import("./index");
  repository = await getInvestigationRepository();
  worker = await import("./worker");
  ctx = {
    userId: "00000000-0000-4000-8000-000000000002",
    workspaceId: "00000000-0000-4000-8000-000000000001",
    role: "owner",
    email: "owner@example.com",
  };
});

afterAll(() => {
  delete process.env.LIFT_INVESTIGATION_STATE_PATH;
  delete process.env.LIFT_MODE;
  delete process.env.WORKER_RETRY_SWEEP_MS;
  rmSync(temp, { recursive: true, force: true });
});

describe("investigation worker cancellation", () => {
  it("cancels a running engine job cleanly and leaves the investigation usable", async () => {
    // The regression: sleep() rejected on abort, so cancelling threw out of the
    // provider loop before processEngineJob could reach its cancellation branch.
    // drain booked it as a failed attempt and re-queued the job with a backoff
    // that nothing ever woke, so the run sat "running" forever, the composer
    // stayed disabled and every later message was rejected with CONFLICT.
    const created = await repository.createInvestigation(ctx, {
      content: "Investigate repeat purchase behaviour for cancellation",
      clientMessageId: "worker-cancel-1",
      intentHint: "investigate",
    });

    // Exactly what POST /api/investigations does: kick and let the pump run.
    worker.kickInvestigationWorkers();

    // The assistant turn routes to "investigate", enqueues a run, and the engine
    // queue picks it up on its own.
    let runId = "";
    await vi.waitFor(
      async () => {
        const detail = await repository.getInvestigation(ctx, created.id);
        const run = detail?.runs.at(-1);
        expect(run?.status).toBe("running");
        runId = run!.id;
      },
      { timeout: 15_000, interval: 100 },
    );

    // Mid-stream cancel, exactly what POST /api/runs/[runId]/cancel does.
    await repository.cancelRun(ctx, runId);
    worker.abortActiveRun(runId);

    await vi.waitFor(
      async () => {
        expect((await repository.getRun(runId))?.status).toBe("cancelled");
      },
      { timeout: 15_000, interval: 100 },
    );

    // The wedge was that the investigation became unusable. It must not be.
    const detail = await repository.getInvestigation(ctx, created.id);
    expect(detail?.activeRunStatus ?? null).toBeNull();
    const next = await repository.enqueueMessage(ctx, created.id, {
      content: "What did we learn before I cancelled?",
      clientMessageId: "worker-cancel-followup",
      intentHint: "answer",
    });
    expect(next.id).toBeTruthy();
  }, 30_000);

  it("processes a queued turn from the pump alone, with no explicit drain", async () => {
    // kickInvestigationWorkers is all a route handler does; nothing else polls in
    // the web process, so the pump has to carry the turn to completion by itself.
    const created = await repository.createInvestigation(ctx, {
      content: "Sweep check",
      clientMessageId: "worker-sweep-1",
      intentHint: "answer",
    });
    worker.kickInvestigationWorkers();
    await vi.waitFor(
      async () => {
        const detail = await repository.getInvestigation(ctx, created.id);
        expect(detail?.messages.some((message) => message.role === "assistant")).toBe(true);
      },
      { timeout: 15_000, interval: 250 },
    );
  }, 20_000);
});

describe("terminal assistant failure recovery", () => {
  it("unlocks the investigation when a turn fails permanently", async () => {
    // Assistant jobs carry no runId, so the old drain never marked anything
    // failed: the input message stayed "queued" and enqueueMessage rejected
    // every later message with CONFLICT, forever.
    const created = await repository.createInvestigation(ctx, {
      content: "Terminal failure investigation",
      clientMessageId: "worker-terminal-1",
      intentHint: "investigate",
    });
    const input = created.messages[0]!;

    await expect(
      repository.enqueueMessage(ctx, created.id, {
        content: "second message while the first is still queued",
        clientMessageId: "worker-terminal-2",
        intentHint: "answer",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    await repository.failMessage(input.id, "provider unavailable");

    expect((await repository.getMessage(input.id))?.status).toBe("error");
    const recovered = await repository.enqueueMessage(ctx, created.id, {
      content: "retry after the failure",
      clientMessageId: "worker-terminal-3",
      intentHint: "answer",
    });
    expect(recovered.id).toBeTruthy();
  });
});
