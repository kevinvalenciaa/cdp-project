import type { EngineEvent, Opportunity, RunDetail } from "@/lib/types";

export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";
export type InvestigationStatus = "active" | "archived";
export type MessageRole = "user" | "assistant";
export type MessageIntent = "auto" | "answer" | "investigate" | "clarify";
export type MessageStatus = "queued" | "running" | "complete" | "error" | "cancelled";
export type RunStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface RequestContext {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
  email: string;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
}

export interface InvestigationSummary {
  id: string;
  workspaceId: string;
  createdBy: string;
  title: string;
  objective: string;
  status: InvestigationStatus;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  activeRunStatus: RunStatus | null;
  provenCount: number;
}

export interface InvestigationMessage {
  id: string;
  investigationId: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  intent: MessageIntent;
  clientMessageId: string | null;
  runId: string | null;
  citations: string[];
  error: string | null;
  createdAt: string;
}

export interface InvestigationContextV1 {
  version: 1;
  objective: string;
  currentPrompt: string;
  recentMessages: Array<Pick<InvestigationMessage, "role" | "content">>;
  scopedResults: Array<{
    occurrenceId: string;
    key: string;
    title: string;
    accepted: boolean;
    verdict: string;
    impactMonthly: number;
    reason: string;
  }>;
  referencedOccurrenceIds: string[];
  workspaceInsights: Array<{ subject: string; claim: string; verdict: string }>;
}

export interface InvestigationRun {
  id: string;
  investigationId: string;
  inputMessageId: string;
  assistantMessageId: string;
  goal: string;
  status: RunStatus;
  context: InvestigationContextV1;
  result: RunDetail | null;
  costUsd: number | null;
  cancelRequested: boolean;
  error: string | null;
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface OpportunityOccurrence {
  id: string;
  workspaceId: string;
  investigationId: string;
  runId: string;
  opportunityKey: string;
  accepted: boolean;
  verdict: string;
  impactMonthly: number;
  verifiedAt: string;
  validUntil: string;
  opportunity: Opportunity;
  sourceInvestigationTitle: string;
  supersededByOccurrenceId: string | null;
}

export interface WorkspaceOpportunity {
  key: string;
  current: OpportunityOccurrence;
  occurrenceCount: number;
  status: "proven" | "superseded" | "stale";
  activationStatus: "live" | null;
}

export interface InvestigationEventEnvelope {
  id: number;
  workspaceId: string;
  investigationId: string;
  messageId: string | null;
  runId: string | null;
  eventDedupeKey: string;
  event: EngineEvent | InvestigationSystemEvent;
  createdAt: string;
}

export type InvestigationSystemEvent =
  | { kind: "message_queued"; messageId: string }
  | { kind: "message_answered"; messageId: string }
  | { kind: "clarification_requested"; messageId: string }
  | { kind: "run_queued"; runId: string; messageId: string }
  | { kind: "run_cancelled"; runId: string }
  | { kind: "investigation_updated"; investigationId: string };

export interface InvestigationDetail extends InvestigationSummary {
  messages: InvestigationMessage[];
  runs: InvestigationRun[];
  results: OpportunityOccurrence[];
  /**
   * Highest event id already reflected in this payload. The client opens its
   * event stream at this cursor; starting from 0 made the server replay the whole
   * history on every mount and reconnect, and every replayed terminal event
   * triggered a refetch of state the client was already holding.
   */
  lastEventId: number;
}

export type ShareScope = "proven" | "transcript" | "full";

export interface ShareOpportunity {
  occurrenceId: string;
  key: string;
  title: string;
  segment: string;
  reason: string;
  impactMonthly: number;
  upliftPp: number | null;
  ci: [number, number] | null;
  pValue: number | null;
  verdict: string;
  verifiedAt: string;
}

export interface ShareSnapshotV1 {
  version: 1;
  investigationId: string;
  title: string;
  objective: string;
  asOf: string;
  scope: ShareScope;
  opportunities: ShareOpportunity[];
  transcript?: Array<Pick<InvestigationMessage, "role" | "content" | "createdAt">>;
}

export interface ShareRecord {
  id: string;
  workspaceId: string;
  investigationId: string;
  createdBy: string;
  tokenHash: string;
  snapshot: ShareSnapshotV1;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface JobRecord {
  id: string;
  workspaceId: string;
  investigationId: string;
  messageId: string | null;
  runId: string | null;
  queue: "assistant" | "engine";
  status: "queued" | "leased" | "completed" | "failed" | "cancelled";
  attempts: number;
  maxAttempts: number;
  availableAt: string;
  leaseExpiresAt: string | null;
  workerId: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OpportunityFilters {
  status?: "proven" | "superseded" | "stale" | "all";
  query?: string;
  investigationId?: string;
  cursor?: { impactMonthly: number; key: string };
  limit?: number;
}

export interface RunExecutionInput {
  runId: string;
  workspaceId: string;
  investigationId: string;
  goal: string;
  context: InvestigationContextV1;
}

export interface RunCheckpointStore {
  get<T>(stage: string, key: string): Promise<T | null>;
  put<T>(stage: string, key: string, payload: T): Promise<void>;
}

export interface DiscoveryEngine {
  execute(
    input: RunExecutionInput,
    controls: {
      emit(event: EngineEvent): Promise<void>;
      checkpoints: RunCheckpointStore;
      signal: AbortSignal;
    },
  ): Promise<RunDetail>;
}

export interface ConversationRoutingInput {
  message: InvestigationMessage;
  investigation: InvestigationDetail;
  scopedResults: OpportunityOccurrence[];
}

export interface GroundedAnswerInput extends ConversationRoutingInput {
  occurrenceIds: string[];
}

export interface GroundedAnswer {
  content: string;
  citations: string[];
}

export type MessageRoute =
  | { intent: "answer"; occurrenceIds: string[] }
  | { intent: "investigate"; normalizedGoal: string; occurrenceIds: string[] }
  | { intent: "clarify"; question: string };

export interface ConversationAgent {
  route(input: ConversationRoutingInput): Promise<MessageRoute>;
  answer(input: GroundedAnswerInput): Promise<GroundedAnswer>;
}
