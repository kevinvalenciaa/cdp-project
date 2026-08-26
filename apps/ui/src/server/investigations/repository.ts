import type {
  ActivationResult,
  ActivationSummary,
  EngineEvent,
  InsightRecord,
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
  WorkspaceRole,
  WorkspaceSummary,
} from "@/lib/investigations";

export interface InvestigationRepository {
  resolveWorkspace(user: { id: string; email: string }, preferredWorkspaceId?: string): Promise<RequestContext>;
  listWorkspaces(userId: string): Promise<WorkspaceSummary[]>;
  listInvestigations(
    ctx: RequestContext,
    options?: {
      status?: InvestigationStatus;
      query?: string;
      cursor?: { lastActivityAt: string; id: string };
      limit?: number;
    },
  ): Promise<InvestigationSummary[]>;
  createInvestigation(
    ctx: RequestContext,
    input: { content: string; clientMessageId: string; intentHint: MessageIntent },
  ): Promise<InvestigationDetail>;
  getInvestigation(ctx: RequestContext, investigationId: string): Promise<InvestigationDetail | null>;
  updateInvestigation(
    ctx: RequestContext,
    investigationId: string,
    patch: { title?: string; status?: InvestigationStatus },
  ): Promise<InvestigationDetail | null>;
  enqueueMessage(
    ctx: RequestContext,
    investigationId: string,
    input: { content: string; clientMessageId: string; intentHint: MessageIntent },
  ): Promise<InvestigationMessage>;
  listEvents(ctx: RequestContext, investigationId: string, after: number): Promise<InvestigationEventEnvelope[]>;
  waitForInvestigationEvent?(
    investigationId: string,
    signal: AbortSignal,
    timeoutMs: number,
  ): Promise<void>;
  listWorkspaceEvents(ctx: RequestContext, limit?: number): Promise<InvestigationEventEnvelope[]>;
  listInsights(ctx: RequestContext): Promise<InsightRecord[]>;
  listActivations(ctx: RequestContext): Promise<ActivationSummary[]>;
  getLatestActivation(ctx: RequestContext): Promise<ActivationResult | null>;
  recordActivation(
    ctx: RequestContext,
    occurrenceId: string,
    result: ActivationResult,
  ): Promise<void>;
  listOpportunities(ctx: RequestContext, filters?: OpportunityFilters): Promise<WorkspaceOpportunity[]>;
  getWorkspaceOpportunity(ctx: RequestContext, key: string): Promise<{ opportunity: WorkspaceOpportunity; history: OpportunityOccurrence[] } | null>;
  // --- Worker-internal surface. ---------------------------------------------
  // Everything below takes no RequestContext and is therefore NOT workspace
  // scoped: the worker dequeues jobs across all tenants and already knows the
  // ids it is allowed to touch. Never reach these from a route handler with an
  // id supplied by the client - go through a ctx-taking method instead, or you
  // reintroduce a cross-tenant read.
  claimJob(queue: JobRecord["queue"], workerId: string, leaseSeconds: number): Promise<JobRecord | null>;
  completeJob(jobId: string): Promise<void>;
  failJob(jobId: string, error: string): Promise<void>;
  heartbeatJob(jobId: string, workerId: string, leaseSeconds: number): Promise<void>;
  getMessage(messageId: string): Promise<InvestigationMessage | null>;
  getRun(runId: string): Promise<InvestigationRun | null>;
  getRunCheckpointEvents(runId: string): Promise<EngineEvent[]>;
  getScopedResults(investigationId: string): Promise<OpportunityOccurrence[]>;
  completeAnswer(messageId: string, content: string, citations: string[]): Promise<void>;
  completeClarification(messageId: string, question: string): Promise<void>;
  enqueueRun(messageId: string, context: InvestigationContextV1, goal: string): Promise<InvestigationRun>;
  markRunRunning(runId: string): Promise<void>;
  appendEngineEvent(run: InvestigationRun, event: EngineEvent, dedupeKey: string): Promise<InvestigationEventEnvelope | null>;
  completeRun(runId: string, result: RunDetail): Promise<void>;
  failRun(runId: string, error: string): Promise<void>;
  cancelRun(ctx: RequestContext, runId: string): Promise<InvestigationRun | null>;
  finalizeRunCancellation(runId: string): Promise<void>;
  createShare(
    ctx: RequestContext,
    investigationId: string,
    input: { tokenHash: string; snapshot: ShareSnapshotV1; expiresAt: string | null },
  ): Promise<ShareRecord>;
  listShares(ctx: RequestContext, investigationId: string): Promise<ShareRecord[]>;
  getShareByHash(tokenHash: string): Promise<ShareRecord | null>;
  revokeShare(ctx: RequestContext, shareId: string): Promise<boolean>;
}

export class RepositoryError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "FORBIDDEN" | "CONFLICT" | "VALIDATION",
    message: string,
  ) {
    super(message);
  }
}

export function canWrite(role: WorkspaceRole): boolean {
  return role === "owner" || role === "admin" || role === "member";
}

export function canAdmin(role: WorkspaceRole): boolean {
  return role === "owner" || role === "admin";
}
