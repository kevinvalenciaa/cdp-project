import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import boardData from "../../../public/board.json";
import { monthlyImpact } from "@/lib/format";
import type {
  ActivationResult,
  ActivationSummary,
  EngineEvent,
  InsightRecord,
  Opportunity,
  RunDetail,
} from "@/lib/types";
import type {
  InvestigationContextV1,
  InvestigationDetail,
  InvestigationEventEnvelope,
  InvestigationMessage,
  InvestigationRun,
  InvestigationStatus,
  InvestigationSummary,
  JobRecord,
  MessageIntent,
  OpportunityFilters,
  OpportunityOccurrence,
  RequestContext,
  ShareRecord,
  ShareSnapshotV1,
  WorkspaceOpportunity,
  WorkspaceSummary,
} from "@/lib/investigations";
import { canAdmin, canWrite, type InvestigationRepository, RepositoryError } from "./repository";

const STATE_PATH = process.env.LIFT_INVESTIGATION_STATE_PATH
  ? resolve(process.env.LIFT_INVESTIGATION_STATE_PATH)
  : resolve(process.cwd(), "../../runs/investigations-state.json");
const DEMO_WORKSPACE = "00000000-0000-4000-8000-000000000001";
const DEMO_USER = "00000000-0000-4000-8000-000000000002";
const DEMO_INVESTIGATION = "00000000-0000-4000-8000-000000000003";
const DEMO_RUN = "00000000-0000-4000-8000-000000000004";
const DEMO_USER_MESSAGE = "00000000-0000-4000-8000-000000000005";
const DEMO_ASSISTANT_MESSAGE = "00000000-0000-4000-8000-000000000006";

interface LocalState {
  version: 1;
  nextEventId: number;
  investigations: InvestigationSummary[];
  messages: InvestigationMessage[];
  runs: InvestigationRun[];
  events: InvestigationEventEnvelope[];
  occurrences: OpportunityOccurrence[];
  jobs: JobRecord[];
  shares: ShareRecord[];
  activations: Array<{
    id: string;
    workspaceId: string;
    investigationId: string;
    runId: string;
    occurrenceId: string;
    createdBy: string;
    result: ActivationResult;
    createdAt: string;
  }>;
}

let writeChain = Promise.resolve();

function iso(offsetMs = 0): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

function validUntil(from: string): string {
  return new Date(new Date(from).getTime() + 90 * 86_400_000).toISOString();
}

function occurrence(
  opportunity: Opportunity,
  accepted: boolean,
  index: number,
  verifiedAt: string,
): OpportunityOccurrence {
  return {
    id: createHash("sha256").update(`${DEMO_RUN}:${opportunity.key}`).digest("hex").slice(0, 32),
    workspaceId: DEMO_WORKSPACE,
    investigationId: DEMO_INVESTIGATION,
    runId: DEMO_RUN,
    opportunityKey: opportunity.key,
    accepted,
    verdict: opportunity.verdict,
    impactMonthly: monthlyImpact(opportunity),
    verifiedAt: new Date(new Date(verifiedAt).getTime() + index).toISOString(),
    validUntil: validUntil(verifiedAt),
    opportunity,
    sourceInvestigationTitle: "Grow second purchases from one-time buyers",
    supersededByOccurrenceId: null,
  };
}

function seedState(): LocalState {
  const now = iso(-3_600_000);
  const run = boardData as unknown as RunDetail;
  const context: InvestigationContextV1 = {
    version: 1,
    objective: run.goal,
    currentPrompt: run.goal,
    recentMessages: [{ role: "user", content: run.goal }],
    scopedResults: [],
    referencedOccurrenceIds: [],
    workspaceInsights: [],
  };
  const opportunities = [...run.opportunities.ranked, ...run.opportunities.rejected];
  return {
    version: 1,
    nextEventId: 1,
    investigations: [
      {
        id: DEMO_INVESTIGATION,
        workspaceId: DEMO_WORKSPACE,
        createdBy: DEMO_USER,
        title: run.goal.slice(0, 60),
        objective: run.goal,
        status: "active",
        createdAt: now,
        updatedAt: now,
        lastActivityAt: now,
        activeRunStatus: null,
        provenCount: run.opportunities.ranked.length,
      },
    ],
    messages: [
      {
        id: DEMO_USER_MESSAGE,
        investigationId: DEMO_INVESTIGATION,
        role: "user",
        content: run.goal,
        status: "complete",
        intent: "investigate",
        clientMessageId: "demo-initial",
        runId: DEMO_RUN,
        citations: [],
        error: null,
        createdAt: now,
      },
      {
        id: DEMO_ASSISTANT_MESSAGE,
        investigationId: DEMO_INVESTIGATION,
        role: "assistant",
        content: `Done - ${run.opportunities.ranked.length} proven opportunities and ${run.opportunities.rejected.length} ruled out.`,
        status: "complete",
        intent: "investigate",
        clientMessageId: null,
        runId: DEMO_RUN,
        citations: run.opportunities.ranked.map((o) =>
          createHash("sha256").update(`${DEMO_RUN}:${o.key}`).digest("hex").slice(0, 32),
        ),
        error: null,
        createdAt: iso(-3_590_000),
      },
    ],
    runs: [
      {
        id: DEMO_RUN,
        investigationId: DEMO_INVESTIGATION,
        inputMessageId: DEMO_USER_MESSAGE,
        assistantMessageId: DEMO_ASSISTANT_MESSAGE,
        goal: run.goal,
        status: "completed",
        context,
        result: run,
        costUsd: run.costUsd ?? null,
        cancelRequested: false,
        error: null,
        queuedAt: now,
        startedAt: now,
        finishedAt: iso(-3_590_000),
      },
    ],
    events: [],
    occurrences: opportunities.map((o, index) => occurrence(o, o.accepted, index, iso(-3_590_000))),
    jobs: [],
    shares: [],
    activations: [],
  };
}

function readState(): LocalState {
  if (!existsSync(STATE_PATH)) return seedState();
  try {
    const value = JSON.parse(readFileSync(STATE_PATH, "utf8")) as LocalState;
    if (value.version !== 1) return seedState();
    value.activations ??= [];
    return value;
  } catch {
    return seedState();
  }
}

function persist(state: LocalState): void {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  const temp = `${STATE_PATH}.${process.pid}.tmp`;
  writeFileSync(temp, JSON.stringify(state));
  renameSync(temp, STATE_PATH);
}

async function mutate<T>(fn: (state: LocalState) => T | Promise<T>): Promise<T> {
  let result!: T;
  const operation = writeChain.then(async () => {
    const state = readState();
    result = await fn(state);
    persist(state);
  });
  // A rejected validation/conflict operation must reject for its caller without
  // poisoning every later write in this process.
  writeChain = operation.then(
    () => undefined,
    () => undefined,
  );
  await operation;
  return result;
}

function scopedLatest(state: LocalState, investigationId: string): OpportunityOccurrence[] {
  const byKey = new Map<string, OpportunityOccurrence>();
  for (const item of state.occurrences
    .filter((o) => o.investigationId === investigationId)
    .sort((a, b) => a.verifiedAt.localeCompare(b.verifiedAt))) {
    byKey.set(item.opportunityKey, item);
  }
  return [...byKey.values()].sort((a, b) => b.impactMonthly - a.impactMonthly);
}

function detail(state: LocalState, item: InvestigationSummary): InvestigationDetail {
  const runs = state.runs
    .filter((run) => run.investigationId === item.id)
    .sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
  return {
    ...item,
    activeRunStatus: runs.find((run) => run.status === "queued" || run.status === "running")?.status ?? null,
    provenCount: scopedLatest(state, item.id).filter((o) => o.accepted).length,
    messages: state.messages
      .filter((message) => message.investigationId === item.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    runs,
    results: scopedLatest(state, item.id),
  };
}

function assertWorkspace(ctx: RequestContext, item: { workspaceId: string }): void {
  if (ctx.workspaceId !== item.workspaceId) throw new RepositoryError("NOT_FOUND", "Investigation not found.");
}

export class LocalInvestigationRepository implements InvestigationRepository {
  async resolveWorkspace(user: { id: string; email: string }, preferredWorkspaceId?: string): Promise<RequestContext> {
    // preferredWorkspaceId comes straight off the lift-workspace-id cookie, so it
    // is client-controlled. Honouring it unchecked handed out an owner context for
    // any workspace id the caller cared to name; the Postgres implementation looks
    // up membership, and this one has to agree. Falling back to the demo workspace
    // rather than throwing keeps a stale cookie from bricking the local demo.
    const workspaces = await this.listWorkspaces(user.id);
    const membership = workspaces.find((workspace) => workspace.id === preferredWorkspaceId) ?? workspaces[0];
    return {
      userId: user.id || DEMO_USER,
      email: user.email || "maria@fashionretailer.com",
      workspaceId: membership?.id ?? DEMO_WORKSPACE,
      role: membership?.role ?? "owner",
    };
  }

  async listWorkspaces(_userId: string): Promise<WorkspaceSummary[]> {
    return [
      {
        id: DEMO_WORKSPACE,
        name: "Fashion Retailer",
        slug: "fashion-retailer",
        role: "owner",
      },
    ];
  }

  async listInvestigations(
    ctx: RequestContext,
    options: {
      status?: InvestigationStatus;
      query?: string;
      cursor?: { lastActivityAt: string; id: string };
      limit?: number;
    } = {},
  ): Promise<InvestigationSummary[]> {
    const query = options.query?.trim().toLowerCase();
    return readState()
      .investigations.filter(
        (item) =>
          item.workspaceId === ctx.workspaceId &&
          (!options.status || item.status === options.status) &&
          (!options.cursor ||
            item.lastActivityAt < options.cursor.lastActivityAt ||
            (item.lastActivityAt === options.cursor.lastActivityAt && item.id > options.cursor.id)) &&
          (!query || item.title.toLowerCase().includes(query) || item.objective.toLowerCase().includes(query)),
      )
      .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt))
      .slice(0, options.limit ?? 100);
  }

  async createInvestigation(
    ctx: RequestContext,
    input: { content: string; clientMessageId: string; intentHint: MessageIntent },
  ): Promise<InvestigationDetail> {
    if (!canWrite(ctx.role)) throw new RepositoryError("FORBIDDEN", "This workspace role cannot create investigations.");
    return mutate((state) => {
      const now = iso();
      const investigation: InvestigationSummary = {
        id: randomUUID(),
        workspaceId: ctx.workspaceId,
        createdBy: ctx.userId,
        title: input.content.trim().slice(0, 60) || "Untitled investigation",
        objective: input.content.trim(),
        status: "active",
        createdAt: now,
        updatedAt: now,
        lastActivityAt: now,
        activeRunStatus: null,
        provenCount: 0,
      };
      state.investigations.push(investigation);
      const message = this.addQueuedMessage(state, investigation.id, input);
      this.addJob(state, {
        workspaceId: ctx.workspaceId,
        investigationId: investigation.id,
        messageId: message.id,
        runId: null,
        queue: "assistant",
      });
      this.addSystemEvent(state, investigation.id, message.id, null, {
        kind: "message_queued",
        messageId: message.id,
      });
      return detail(state, investigation);
    });
  }

  async getInvestigation(ctx: RequestContext, investigationId: string): Promise<InvestigationDetail | null> {
    const state = readState();
    const item = state.investigations.find((candidate) => candidate.id === investigationId);
    if (!item || item.workspaceId !== ctx.workspaceId) return null;
    return detail(state, item);
  }

  async updateInvestigation(
    ctx: RequestContext,
    investigationId: string,
    patch: { title?: string; status?: InvestigationStatus },
  ): Promise<InvestigationDetail | null> {
    return mutate((state) => {
      const item = state.investigations.find((candidate) => candidate.id === investigationId);
      if (!item) return null;
      assertWorkspace(ctx, item);
      if (!canAdmin(ctx.role) && (ctx.role !== "member" || item.createdBy !== ctx.userId)) {
        throw new RepositoryError("FORBIDDEN", "Only the creator or an administrator can update this investigation.");
      }
      if (patch.title != null) item.title = patch.title.trim().slice(0, 120) || item.title;
      if (patch.status != null) item.status = patch.status;
      item.updatedAt = iso();
      this.addSystemEvent(state, item.id, null, null, { kind: "investigation_updated", investigationId: item.id });
      return detail(state, item);
    });
  }

  async enqueueMessage(
    ctx: RequestContext,
    investigationId: string,
    input: { content: string; clientMessageId: string; intentHint: MessageIntent },
  ): Promise<InvestigationMessage> {
    if (!canWrite(ctx.role)) throw new RepositoryError("FORBIDDEN", "This workspace role cannot send messages.");
    return mutate((state) => {
      const investigation = state.investigations.find((item) => item.id === investigationId);
      if (!investigation) throw new RepositoryError("NOT_FOUND", "Investigation not found.");
      assertWorkspace(ctx, investigation);
      if (investigation.status === "archived") throw new RepositoryError("CONFLICT", "Archived investigations are read-only.");
      const duplicate = state.messages.find(
        (message) => message.investigationId === investigationId && message.clientMessageId === input.clientMessageId,
      );
      if (duplicate) return duplicate;
      if (
        state.messages.some(
          (message) =>
            message.investigationId === investigationId &&
            (message.status === "queued" || message.status === "running"),
        )
      ) {
        throw new RepositoryError("CONFLICT", "Wait for the active investigation turn to finish.");
      }
      if (state.runs.some((run) => run.investigationId === investigationId && (run.status === "queued" || run.status === "running"))) {
        throw new RepositoryError("CONFLICT", "Wait for the active investigation run to finish or cancel it.");
      }
      const message = this.addQueuedMessage(state, investigationId, input);
      this.addJob(state, {
        workspaceId: ctx.workspaceId,
        investigationId,
        messageId: message.id,
        runId: null,
        queue: "assistant",
      });
      investigation.lastActivityAt = message.createdAt;
      investigation.updatedAt = message.createdAt;
      this.addSystemEvent(state, investigationId, message.id, null, { kind: "message_queued", messageId: message.id });
      return message;
    });
  }

  async listEvents(ctx: RequestContext, investigationId: string, after: number): Promise<InvestigationEventEnvelope[]> {
    const state = readState();
    const investigation = state.investigations.find((item) => item.id === investigationId);
    if (!investigation || investigation.workspaceId !== ctx.workspaceId) return [];
    return state.events.filter((event) => event.investigationId === investigationId && event.id > after).sort((a, b) => a.id - b.id);
  }

  async listWorkspaceEvents(ctx: RequestContext, limit = 200): Promise<InvestigationEventEnvelope[]> {
    return readState()
      .events.filter((event) => event.workspaceId === ctx.workspaceId)
      .sort((a, b) => b.id - a.id)
      .slice(0, limit);
  }

  async listInsights(ctx: RequestContext): Promise<InsightRecord[]> {
    const latest = await this.listOpportunities(ctx, { status: "all" });
    return latest.map(({ current }) => ({
      subject: current.opportunityKey,
      subjectType:
        current.opportunity.type === "experiment"
          ? "campaign"
          : current.opportunity.type === "seasonality"
            ? "initiative"
            : "audience",
      claim: current.accepted
        ? `${current.opportunity.title}: verified incremental lift.`
        : `${current.opportunity.title}: ${current.opportunity.reason}`,
      verdict: current.verdict,
      confidence: current.accepted ? 0.9 : 0.8,
      validUntil: current.validUntil,
    }));
  }

  async listActivations(ctx: RequestContext): Promise<ActivationSummary[]> {
    return readState()
      .activations.filter((activation) => activation.workspaceId === ctx.workspaceId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(({ result, createdAt }) => ({
        opportunityKey: result.opportunity.key,
        title: result.opportunity.title,
        destination: result.sync?.destination ?? "-",
        audienceSize: result.audience.persuadableReach,
        upliftPp: result.measurement.upliftPp,
        pValue: result.measurement.pValue,
        verdict: result.measurement.verdict,
        status: "live",
        launchedAt: createdAt.slice(0, 10),
      }));
  }

  async getLatestActivation(ctx: RequestContext): Promise<ActivationResult | null> {
    return (
      readState()
        .activations.filter((activation) => activation.workspaceId === ctx.workspaceId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.result ?? null
    );
  }

  async recordActivation(
    ctx: RequestContext,
    occurrenceId: string,
    result: ActivationResult,
  ): Promise<void> {
    if (!canWrite(ctx.role)) throw new RepositoryError("FORBIDDEN", "This workspace role cannot activate results.");
    await mutate((state) => {
      const occurrence = state.occurrences.find(
        (item) => item.id === occurrenceId && item.workspaceId === ctx.workspaceId,
      );
      if (!occurrence) throw new RepositoryError("NOT_FOUND", "Opportunity occurrence not found.");
      const current = state.occurrences
        .filter(
          (item) =>
            item.workspaceId === ctx.workspaceId &&
            item.opportunityKey === occurrence.opportunityKey,
        )
        .sort((a, b) => b.verifiedAt.localeCompare(a.verifiedAt))[0];
      if (
        current?.id !== occurrence.id ||
        !occurrence.accepted ||
        new Date(occurrence.validUntil).getTime() <= Date.now()
      ) {
        throw new RepositoryError("CONFLICT", "This opportunity is not current.");
      }
      if (state.activations.some((activation) => activation.occurrenceId === occurrenceId)) return;
      state.activations.push({
        id: randomUUID(),
        workspaceId: ctx.workspaceId,
        investigationId: occurrence.investigationId,
        runId: occurrence.runId,
        occurrenceId,
        createdBy: ctx.userId,
        result,
        createdAt: iso(),
      });
    });
  }

  async listOpportunities(ctx: RequestContext, filters: OpportunityFilters = {}): Promise<WorkspaceOpportunity[]> {
    const state = readState();
    const latest = new Map<string, OpportunityOccurrence>();
    const counts = new Map<string, number>();
    for (const item of state.occurrences
      .filter((o) => o.workspaceId === ctx.workspaceId)
      .sort((a, b) => a.verifiedAt.localeCompare(b.verifiedAt))) {
      latest.set(item.opportunityKey, item);
      counts.set(item.opportunityKey, (counts.get(item.opportunityKey) ?? 0) + 1);
    }
    const now = Date.now();
    const query = filters.query?.trim().toLowerCase();
    return [...latest.values()]
      .map((current): WorkspaceOpportunity => ({
        key: current.opportunityKey,
        current,
        occurrenceCount: counts.get(current.opportunityKey) ?? 1,
        status: !current.accepted ? "superseded" : new Date(current.validUntil).getTime() <= now ? "stale" : "proven",
        activationStatus: state.activations.some((activation) => activation.occurrenceId === current.id)
          ? "live"
          : null,
      }))
      .filter(
        (item) =>
          (!filters.status || filters.status === "all" || item.status === filters.status) &&
          (!filters.investigationId || item.current.investigationId === filters.investigationId) &&
          (!query ||
            item.current.opportunity.title.toLowerCase().includes(query) ||
            item.current.opportunity.segment.toLowerCase().includes(query)),
      )
      .sort(
        (a, b) =>
          b.current.impactMonthly - a.current.impactMonthly ||
          a.key.localeCompare(b.key),
      )
      .filter(
        (item) =>
          !filters.cursor ||
          item.current.impactMonthly < filters.cursor.impactMonthly ||
          (item.current.impactMonthly === filters.cursor.impactMonthly && item.key > filters.cursor.key),
      )
      .slice(0, Math.min(filters.limit ?? 500, 500));
  }

  async getWorkspaceOpportunity(
    ctx: RequestContext,
    key: string,
  ): Promise<{ opportunity: WorkspaceOpportunity; history: OpportunityOccurrence[] } | null> {
    const state = readState();
    const history = state.occurrences
      .filter((item) => item.workspaceId === ctx.workspaceId && item.opportunityKey === key)
      .sort((a, b) => b.verifiedAt.localeCompare(a.verifiedAt));
    if (!history[0]) return null;
    const current = history[0];
    const status = !current.accepted
      ? "superseded"
      : new Date(current.validUntil).getTime() <= Date.now()
        ? "stale"
        : "proven";
    return {
      opportunity: {
        key,
        current,
        occurrenceCount: history.length,
        status,
        activationStatus: state.activations.some((activation) => activation.occurrenceId === current.id)
          ? "live"
          : null,
      },
      history,
    };
  }

  async claimJob(queue: JobRecord["queue"], workerId: string, leaseSeconds: number): Promise<JobRecord | null> {
    return mutate((state) => {
      const now = Date.now();
      if (
        queue === "engine" &&
        state.jobs.some(
          (candidate) =>
            candidate.queue === "engine" &&
            candidate.status === "leased" &&
            candidate.leaseExpiresAt != null &&
            new Date(candidate.leaseExpiresAt).getTime() > now,
        )
      ) {
        return null;
      }
      const job = state.jobs
        .filter(
          (candidate) =>
            candidate.queue === queue &&
            (candidate.status === "queued" ||
              (candidate.status === "leased" &&
                candidate.leaseExpiresAt != null &&
                new Date(candidate.leaseExpiresAt).getTime() <= now)) &&
            new Date(candidate.availableAt).getTime() <= now &&
            candidate.attempts < candidate.maxAttempts,
        )
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
      if (!job) return null;
      job.status = "leased";
      job.workerId = workerId;
      job.attempts += 1;
      job.leaseExpiresAt = iso(leaseSeconds * 1000);
      job.updatedAt = iso();
      return { ...job };
    });
  }

  async completeJob(jobId: string): Promise<void> {
    await mutate((state) => {
      const job = state.jobs.find((item) => item.id === jobId);
      if (!job || job.status !== "leased") return;
      job.status = "completed";
      job.leaseExpiresAt = null;
      job.updatedAt = iso();
    });
  }

  async failJob(jobId: string, error: string): Promise<void> {
    await mutate((state) => {
      const job = state.jobs.find((item) => item.id === jobId);
      if (!job) return;
      job.lastError = error;
      job.workerId = null;
      job.leaseExpiresAt = null;
      job.status = job.attempts >= job.maxAttempts ? "failed" : "queued";
      job.availableAt = iso(Math.min(30_000, 1_000 * 2 ** job.attempts));
      job.updatedAt = iso();
    });
  }

  async heartbeatJob(jobId: string, workerId: string, leaseSeconds: number): Promise<void> {
    await mutate((state) => {
      const job = state.jobs.find((item) => item.id === jobId && item.workerId === workerId && item.status === "leased");
      if (job) job.leaseExpiresAt = iso(leaseSeconds * 1000);
    });
  }

  async getMessage(messageId: string): Promise<InvestigationMessage | null> {
    return readState().messages.find((message) => message.id === messageId) ?? null;
  }

  async getRun(runId: string): Promise<InvestigationRun | null> {
    return readState().runs.find((run) => run.id === runId) ?? null;
  }

  async getRunCheckpointEvents(runId: string): Promise<EngineEvent[]> {
    return readState()
      .events.filter(
        (envelope) =>
          envelope.runId === runId &&
          (envelope.event.kind === "hypothesis_proposed" ||
            envelope.event.kind === "planning" ||
            envelope.event.kind === "candidate_verified" ||
            envelope.event.kind === "prioritizing"),
      )
      .map((envelope) => envelope.event as EngineEvent);
  }

  async getScopedResults(investigationId: string): Promise<OpportunityOccurrence[]> {
    return scopedLatest(readState(), investigationId);
  }

  async completeAnswer(messageId: string, content: string, citations: string[]): Promise<void> {
    await mutate((state) => {
      const input = state.messages.find((message) => message.id === messageId);
      if (!input) throw new RepositoryError("NOT_FOUND", "Message not found.");
      input.status = "complete";
      input.intent = "answer";
      const reply: InvestigationMessage = {
        id: randomUUID(),
        investigationId: input.investigationId,
        role: "assistant",
        content,
        status: "complete",
        intent: "answer",
        clientMessageId: null,
        runId: null,
        citations,
        error: null,
        createdAt: iso(),
      };
      state.messages.push(reply);
      this.touch(state, input.investigationId, reply.createdAt);
      this.addSystemEvent(state, input.investigationId, reply.id, null, {
        kind: "message_answered",
        messageId: reply.id,
      });
    });
  }

  async completeClarification(messageId: string, question: string): Promise<void> {
    await mutate((state) => {
      const input = state.messages.find((message) => message.id === messageId);
      if (!input) throw new RepositoryError("NOT_FOUND", "Message not found.");
      input.status = "complete";
      input.intent = "clarify";
      const reply: InvestigationMessage = {
        id: randomUUID(),
        investigationId: input.investigationId,
        role: "assistant",
        content: question,
        status: "complete",
        intent: "clarify",
        clientMessageId: null,
        runId: null,
        citations: [],
        error: null,
        createdAt: iso(),
      };
      state.messages.push(reply);
      this.touch(state, input.investigationId, reply.createdAt);
      this.addSystemEvent(state, input.investigationId, reply.id, null, {
        kind: "clarification_requested",
        messageId: reply.id,
      });
    });
  }

  async enqueueRun(messageId: string, context: InvestigationContextV1, goal: string): Promise<InvestigationRun> {
    return mutate((state) => {
      const input = state.messages.find((message) => message.id === messageId);
      if (!input) throw new RepositoryError("NOT_FOUND", "Message not found.");
      input.status = "complete";
      input.intent = "investigate";
      const assistant: InvestigationMessage = {
        id: randomUUID(),
        investigationId: input.investigationId,
        role: "assistant",
        content: "Investigation queued…",
        status: "queued",
        intent: "investigate",
        clientMessageId: null,
        runId: null,
        citations: [],
        error: null,
        createdAt: iso(),
      };
      const run: InvestigationRun = {
        id: randomUUID(),
        investigationId: input.investigationId,
        inputMessageId: input.id,
        assistantMessageId: assistant.id,
        goal,
        status: "queued",
        context,
        result: null,
        costUsd: null,
        cancelRequested: false,
        error: null,
        queuedAt: assistant.createdAt,
        startedAt: null,
        finishedAt: null,
      };
      input.runId = run.id;
      assistant.runId = run.id;
      state.messages.push(assistant);
      state.runs.push(run);
      const investigation = state.investigations.find((item) => item.id === run.investigationId);
      if (!investigation) throw new RepositoryError("NOT_FOUND", "Investigation not found.");
      this.addJob(state, {
        workspaceId: investigation.workspaceId,
        investigationId: investigation.id,
        messageId: assistant.id,
        runId: run.id,
        queue: "engine",
      });
      this.touch(state, investigation.id, assistant.createdAt);
      this.addSystemEvent(state, investigation.id, assistant.id, run.id, {
        kind: "run_queued",
        runId: run.id,
        messageId: assistant.id,
      });
      return { ...run };
    });
  }

  async markRunRunning(runId: string): Promise<void> {
    await mutate((state) => {
      const run = state.runs.find((candidate) => candidate.id === runId);
      if (!run) throw new RepositoryError("NOT_FOUND", "Run not found.");
      run.status = "running";
      run.startedAt = iso();
      const assistant = state.messages.find((message) => message.id === run.assistantMessageId);
      if (assistant) {
        assistant.status = "running";
        assistant.content = "Investigating…";
      }
      this.touch(state, run.investigationId, run.startedAt);
    });
  }

  async appendEngineEvent(
    run: InvestigationRun,
    event: EngineEvent,
    dedupeKey: string,
  ): Promise<InvestigationEventEnvelope | null> {
    return mutate((state) => {
      if (state.events.some((item) => item.runId === run.id && item.eventDedupeKey === dedupeKey)) return null;
      const investigation = state.investigations.find((item) => item.id === run.investigationId);
      if (!investigation) return null;
      const envelope: InvestigationEventEnvelope = {
        id: state.nextEventId++,
        workspaceId: investigation.workspaceId,
        investigationId: run.investigationId,
        messageId: run.assistantMessageId,
        runId: run.id,
        eventDedupeKey: dedupeKey,
        event,
        createdAt: iso(),
      };
      state.events.push(envelope);
      return envelope;
    });
  }

  async completeRun(runId: string, result: RunDetail): Promise<void> {
    await mutate((state) => {
      const run = state.runs.find((candidate) => candidate.id === runId);
      if (!run) throw new RepositoryError("NOT_FOUND", "Run not found.");
      if (run.status === "completed") return;
      const investigation = state.investigations.find((item) => item.id === run.investigationId);
      if (!investigation) throw new RepositoryError("NOT_FOUND", "Investigation not found.");
      const completedAt = iso();
      run.result = { ...result, finishedAt: completedAt };
      run.costUsd = result.costUsd ?? null;
      run.status = "completed";
      run.finishedAt = completedAt;
      for (const old of state.occurrences.filter((item) => item.workspaceId === investigation.workspaceId)) {
        const replacement = [...result.opportunities.ranked, ...result.opportunities.rejected].find(
          (item) => item.key === old.opportunityKey,
        );
        if (replacement) old.supersededByOccurrenceId = `${run.id}:${replacement.key}`;
      }
      const items = [...result.opportunities.ranked, ...result.opportunities.rejected];
      const occurrenceIds: string[] = [];
      items.forEach((opportunity, index) => {
        const id = `${run.id}:${opportunity.key}`;
        occurrenceIds.push(id);
        if (state.occurrences.some((item) => item.id === id)) return;
        state.occurrences.push({
          id,
          workspaceId: investigation.workspaceId,
          investigationId: investigation.id,
          runId: run.id,
          opportunityKey: opportunity.key,
          accepted: opportunity.accepted,
          verdict: opportunity.verdict,
          impactMonthly: monthlyImpact(opportunity),
          verifiedAt: new Date(new Date(completedAt).getTime() + index).toISOString(),
          validUntil: validUntil(completedAt),
          opportunity,
          sourceInvestigationTitle: investigation.title,
          supersededByOccurrenceId: null,
        });
      });
      const assistant = state.messages.find((message) => message.id === run.assistantMessageId);
      if (assistant) {
        assistant.status = "complete";
        assistant.content = `Done - ${result.opportunities.ranked.length} proven opportunities and ${result.opportunities.rejected.length} ruled out.`;
        assistant.citations = occurrenceIds.filter((id) =>
          result.opportunities.ranked.some((opportunity) => id.endsWith(`:${opportunity.key}`)),
        );
      }
      for (const job of state.jobs.filter(
        (item) => item.runId === run.id && (item.status === "queued" || item.status === "leased"),
      )) {
        job.status = "completed";
        job.leaseExpiresAt = null;
        job.updatedAt = completedAt;
      }
      this.addSystemEvent(state, investigation.id, run.assistantMessageId, run.id, {
        kind: "run_finished",
        result: run.result,
      });
      investigation.provenCount = scopedLatest(state, investigation.id).filter((item) => item.accepted).length;
      investigation.activeRunStatus = null;
      this.touch(state, investigation.id, completedAt);
    });
  }

  async failRun(runId: string, error: string): Promise<void> {
    await mutate((state) => {
      const run = state.runs.find((candidate) => candidate.id === runId);
      if (!run) return;
      run.status = "failed";
      run.error = error;
      run.finishedAt = iso();
      const assistant = state.messages.find((message) => message.id === run.assistantMessageId);
      if (assistant) {
        assistant.status = "error";
        assistant.error = error;
        assistant.content = "The investigation failed. You can retry the same request.";
      }
      this.addSystemEvent(state, run.investigationId, run.assistantMessageId, run.id, {
        kind: "error",
        message: error,
      });
      this.touch(state, run.investigationId, run.finishedAt);
    });
  }

  async cancelRun(ctx: RequestContext, runId: string): Promise<InvestigationRun | null> {
    return mutate((state) => {
      const run = state.runs.find((candidate) => candidate.id === runId);
      if (!run) return null;
      const investigation = state.investigations.find((item) => item.id === run.investigationId);
      if (!investigation) return null;
      assertWorkspace(ctx, investigation);
      if (!canWrite(ctx.role)) throw new RepositoryError("FORBIDDEN", "This workspace role cannot cancel runs.");
      run.cancelRequested = true;
      if (run.status === "queued") {
        run.status = "cancelled";
        run.finishedAt = iso();
        for (const job of state.jobs.filter((item) => item.runId === run.id && item.status === "queued")) job.status = "cancelled";
        const assistant = state.messages.find((message) => message.id === run.assistantMessageId);
        if (assistant) {
          assistant.status = "cancelled";
          assistant.content = "Investigation cancelled.";
        }
        this.addSystemEvent(state, investigation.id, run.assistantMessageId, run.id, {
          kind: "run_cancelled",
          runId: run.id,
        });
      }
      return { ...run };
    });
  }

  async finalizeRunCancellation(runId: string): Promise<void> {
    await mutate((state) => {
      const run = state.runs.find((candidate) => candidate.id === runId);
      if (!run || run.status === "completed" || run.status === "cancelled") return;
      run.cancelRequested = true;
      run.status = "cancelled";
      run.finishedAt = iso();
      for (const job of state.jobs.filter(
        (item) => item.runId === run.id && (item.status === "queued" || item.status === "leased"),
      )) {
        job.status = "cancelled";
        job.leaseExpiresAt = null;
        job.updatedAt = run.finishedAt;
      }
      const assistant = state.messages.find((message) => message.id === run.assistantMessageId);
      if (assistant) {
        assistant.status = "cancelled";
        assistant.content = "Investigation cancelled.";
      }
      this.addSystemEvent(state, run.investigationId, run.assistantMessageId, run.id, {
        kind: "run_cancelled",
        runId: run.id,
      });
      this.touch(state, run.investigationId, run.finishedAt);
    });
  }

  async createShare(
    ctx: RequestContext,
    investigationId: string,
    input: { tokenHash: string; snapshot: ShareSnapshotV1; expiresAt: string | null },
  ): Promise<ShareRecord> {
    if (!canWrite(ctx.role)) throw new RepositoryError("FORBIDDEN", "This workspace role cannot create shares.");
    return mutate((state) => {
      const investigation = state.investigations.find((item) => item.id === investigationId);
      if (!investigation) throw new RepositoryError("NOT_FOUND", "Investigation not found.");
      assertWorkspace(ctx, investigation);
      const share: ShareRecord = {
        id: randomUUID(),
        workspaceId: ctx.workspaceId,
        investigationId,
        createdBy: ctx.userId,
        tokenHash: input.tokenHash,
        snapshot: input.snapshot,
        expiresAt: input.expiresAt,
        revokedAt: null,
        createdAt: iso(),
      };
      state.shares.push(share);
      return share;
    });
  }

  async listShares(ctx: RequestContext, investigationId: string): Promise<ShareRecord[]> {
    return readState()
      .shares.filter(
        (share) =>
          share.workspaceId === ctx.workspaceId &&
          share.investigationId === investigationId &&
          (canAdmin(ctx.role) || share.createdBy === ctx.userId),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getShareByHash(tokenHash: string): Promise<ShareRecord | null> {
    return readState().shares.find((share) => share.tokenHash === tokenHash) ?? null;
  }

  async revokeShare(ctx: RequestContext, shareId: string): Promise<boolean> {
    return mutate((state) => {
      const share = state.shares.find((item) => item.id === shareId);
      if (!share || share.workspaceId !== ctx.workspaceId) return false;
      if (!canAdmin(ctx.role) && share.createdBy !== ctx.userId) {
        throw new RepositoryError("FORBIDDEN", "Only the creator or an administrator can revoke this share.");
      }
      share.revokedAt = iso();
      return true;
    });
  }

  private addQueuedMessage(
    state: LocalState,
    investigationId: string,
    input: { content: string; clientMessageId: string; intentHint: MessageIntent },
  ): InvestigationMessage {
    const message: InvestigationMessage = {
      id: randomUUID(),
      investigationId,
      role: "user",
      content: input.content.trim(),
      status: "queued",
      intent: input.intentHint,
      clientMessageId: input.clientMessageId,
      runId: null,
      citations: [],
      error: null,
      createdAt: iso(),
    };
    state.messages.push(message);
    return message;
  }

  private addJob(
    state: LocalState,
    input: Pick<JobRecord, "workspaceId" | "investigationId" | "messageId" | "runId" | "queue">,
  ): JobRecord {
    const now = iso();
    const job: JobRecord = {
      id: randomUUID(),
      ...input,
      status: "queued",
      attempts: 0,
      maxAttempts: 3,
      availableAt: now,
      leaseExpiresAt: null,
      workerId: null,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    };
    state.jobs.push(job);
    return job;
  }

  private addSystemEvent(
    state: LocalState,
    investigationId: string,
    messageId: string | null,
    runId: string | null,
    event: InvestigationEventEnvelope["event"],
  ): void {
    const investigation = state.investigations.find((item) => item.id === investigationId);
    if (!investigation) return;
    const eventDedupeKey = `${event.kind}:${messageId ?? runId ?? randomUUID()}`;
    if (state.events.some((item) => item.investigationId === investigationId && item.eventDedupeKey === eventDedupeKey)) return;
    state.events.push({
      id: state.nextEventId++,
      workspaceId: investigation.workspaceId,
      investigationId,
      messageId,
      runId,
      eventDedupeKey,
      event,
      createdAt: iso(),
    });
  }

  private touch(state: LocalState, investigationId: string, at: string): void {
    const investigation = state.investigations.find((item) => item.id === investigationId);
    if (!investigation) return;
    investigation.updatedAt = at;
    investigation.lastActivityAt = at;
  }
}

export const LOCAL_INVESTIGATION_STATE_FILE = STATE_PATH;
