import postgres, { type JSONValue, type Sql, type TransactionSql } from "postgres";
import { randomUUID } from "node:crypto";
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
  WorkspaceRole,
  WorkspaceSummary,
} from "@/lib/investigations";
import { canAdmin, canWrite, type InvestigationRepository, RepositoryError } from "./repository";

type Row = Record<string, unknown>;
type QuerySql = Sql | TransactionSql;

function pgJson(value: unknown): JSONValue {
  return JSON.parse(JSON.stringify(value)) as JSONValue;
}

function date(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}

function nullableDate(value: unknown): string | null {
  return value == null ? null : date(value);
}

function json<T>(value: unknown): T {
  if (typeof value === "string") return JSON.parse(value) as T;
  return value as T;
}

function messageFrom(row: Row): InvestigationMessage {
  return {
    id: String(row.id),
    investigationId: String(row.investigation_id),
    role: row.role as InvestigationMessage["role"],
    content: String(row.content),
    status: row.status as InvestigationMessage["status"],
    intent: row.intent as InvestigationMessage["intent"],
    clientMessageId: row.client_message_id == null ? null : String(row.client_message_id),
    runId: row.run_id == null ? null : String(row.run_id),
    citations: json<string[]>(row.citations ?? []),
    error: row.error == null ? null : String(row.error),
    createdAt: date(row.created_at),
  };
}

function runFrom(row: Row): InvestigationRun {
  return {
    id: String(row.id),
    investigationId: String(row.investigation_id),
    inputMessageId: String(row.input_message_id),
    assistantMessageId: String(row.assistant_message_id),
    goal: String(row.goal),
    status: row.status as InvestigationRun["status"],
    context: json<InvestigationContextV1>(row.context),
    result: row.result == null ? null : json<RunDetail>(row.result),
    costUsd: row.cost_usd == null ? null : Number(row.cost_usd),
    cancelRequested: Boolean(row.cancel_requested),
    error: row.error == null ? null : String(row.error),
    queuedAt: date(row.queued_at),
    startedAt: nullableDate(row.started_at),
    finishedAt: nullableDate(row.finished_at),
  };
}

function occurrenceFrom(row: Row): OpportunityOccurrence {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    investigationId: String(row.investigation_id),
    runId: String(row.run_id),
    opportunityKey: String(row.opportunity_key),
    accepted: Boolean(row.accepted),
    verdict: String(row.verdict),
    impactMonthly: Number(row.impact_monthly),
    verifiedAt: date(row.verified_at),
    validUntil: date(row.valid_until),
    opportunity: json<Opportunity>(row.opportunity),
    sourceInvestigationTitle: String(row.source_investigation_title),
    supersededByOccurrenceId:
      row.superseded_by_occurrence_id == null ? null : String(row.superseded_by_occurrence_id),
  };
}

function eventFrom(row: Row): InvestigationEventEnvelope {
  return {
    id: Number(row.id),
    workspaceId: String(row.workspace_id),
    investigationId: String(row.investigation_id),
    messageId: row.message_id == null ? null : String(row.message_id),
    runId: row.run_id == null ? null : String(row.run_id),
    eventDedupeKey: String(row.event_dedupe_key),
    event: json<InvestigationEventEnvelope["event"]>(row.event),
    createdAt: date(row.created_at),
  };
}

function jobFrom(row: Row): JobRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    investigationId: String(row.investigation_id),
    messageId: row.message_id == null ? null : String(row.message_id),
    runId: row.run_id == null ? null : String(row.run_id),
    queue: row.queue as JobRecord["queue"],
    status: row.status as JobRecord["status"],
    attempts: Number(row.attempts),
    maxAttempts: Number(row.max_attempts),
    availableAt: date(row.available_at),
    leaseExpiresAt: nullableDate(row.lease_expires_at),
    workerId: row.worker_id == null ? null : String(row.worker_id),
    lastError: row.last_error == null ? null : String(row.last_error),
    createdAt: date(row.created_at),
    updatedAt: date(row.updated_at),
  };
}

function shareFrom(row: Row): ShareRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    investigationId: String(row.investigation_id),
    createdBy: String(row.created_by),
    tokenHash: String(row.token_hash),
    snapshot: json<ShareSnapshotV1>(row.snapshot),
    expiresAt: nullableDate(row.expires_at),
    revokedAt: nullableDate(row.revoked_at),
    createdAt: date(row.created_at),
  };
}

export class PostgresInvestigationRepository implements InvestigationRepository {
  private readonly sql: Sql;

  constructor(databaseUrl: string) {
    this.sql = postgres(databaseUrl, { max: Number(process.env.POSTGRES_POOL_SIZE ?? 10) });
  }

  async close(): Promise<void> {
    await this.sql.end();
  }

  async resolveWorkspace(user: { id: string; email: string }, preferredWorkspaceId?: string): Promise<RequestContext> {
    return this.sql.begin(async (tx) => {
      await tx`
        insert into public.profiles (id, email)
        values (${user.id}::uuid, ${user.email})
        on conflict (id) do update set email = excluded.email, updated_at = now()
      `;
      let rows: Row[] = [];
      if (preferredWorkspaceId) {
        rows = await tx<Row[]>`
          select membership.workspace_id, membership.role
          from public.workspace_memberships membership
          where membership.user_id = ${user.id}::uuid
            and membership.workspace_id = ${preferredWorkspaceId}::uuid
          limit 1
        `;
      }
      if (!rows[0]) {
        rows = await tx<Row[]>`
          select membership.workspace_id, membership.role
          from public.workspace_memberships membership
          where membership.user_id = ${user.id}::uuid
          order by membership.created_at
          limit 1
        `;
      }
      if (!rows[0]) {
        const local = user.email.split("@")[0]?.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "workspace";
        const slug = `${local}-${user.id.slice(0, 8)}`;
        const workspaces = await tx<Row[]>`
          insert into public.workspaces (name, slug)
          values (${`${local}'s workspace`}, ${slug})
          returning id
        `;
        const workspaceId = String(workspaces[0]!.id);
        await tx`
          insert into public.workspace_memberships (workspace_id, user_id, role)
          values (${workspaceId}::uuid, ${user.id}::uuid, 'owner')
        `;
        rows = [{ workspace_id: workspaceId, role: "owner" }];
      }
      return {
        userId: user.id,
        email: user.email,
        workspaceId: String(rows[0]!.workspace_id),
        role: rows[0]!.role as WorkspaceRole,
      };
    });
  }

  async listWorkspaces(userId: string): Promise<WorkspaceSummary[]> {
    const rows = await this.sql<Row[]>`
      select workspace.id, workspace.name, workspace.slug, membership.role
      from public.workspace_memberships membership
      join public.workspaces workspace on workspace.id = membership.workspace_id
      where membership.user_id = ${userId}::uuid
      order by membership.created_at, workspace.id
    `;
    return rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      slug: String(row.slug),
      role: row.role as WorkspaceRole,
    }));
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
    const status = options.status ?? null;
    const query = options.query?.trim() ? `%${options.query.trim()}%` : null;
    const cursorAt = options.cursor?.lastActivityAt ?? null;
    const cursorId = options.cursor?.id ?? null;
    const rows = await this.sql<Row[]>`
      select investigation.*,
        (
          select run.status
          from public.investigation_runs run
          where run.investigation_id = investigation.id
            and run.status in ('queued', 'running')
          order by run.queued_at desc
          limit 1
        ) active_run_status,
        (
          select count(*)
          from (
            select distinct on (occurrence.opportunity_key) occurrence.accepted
            from public.opportunity_occurrences occurrence
            where occurrence.investigation_id = investigation.id
            order by occurrence.opportunity_key, occurrence.verified_at desc
          ) latest
          where latest.accepted
        ) proven_count
      from public.investigations investigation
      where investigation.workspace_id = ${ctx.workspaceId}::uuid
        and (${status}::text is null or investigation.status = ${status})
        and (
          ${query}::text is null
          or investigation.title ilike ${query}
          or investigation.objective ilike ${query}
        )
        and (
          ${cursorAt}::timestamptz is null
          or investigation.last_activity_at < ${cursorAt}::timestamptz
          or (
            investigation.last_activity_at = ${cursorAt}::timestamptz
            and investigation.id > ${cursorId}::uuid
          )
        )
      order by investigation.last_activity_at desc, investigation.id
      limit ${Math.min(options.limit ?? 100, 100)}
    `;
    return rows.map((row) => this.summaryFrom(row));
  }

  async createInvestigation(
    ctx: RequestContext,
    input: { content: string; clientMessageId: string; intentHint: MessageIntent },
  ): Promise<InvestigationDetail> {
    if (!canWrite(ctx.role)) throw new RepositoryError("FORBIDDEN", "This workspace role cannot create investigations.");
    const id = await this.sql.begin(async (tx) => {
      const investigations = await tx<Row[]>`
        insert into public.investigations (workspace_id, created_by, title, objective)
        values (
          ${ctx.workspaceId}::uuid,
          ${ctx.userId}::uuid,
          ${input.content.trim().slice(0, 60) || "Untitled investigation"},
          ${input.content.trim()}
        )
        returning id
      `;
      const investigationId = String(investigations[0]!.id);
      const messages = await tx<Row[]>`
        insert into public.investigation_messages (
          workspace_id, investigation_id, role, content, status, intent, client_message_id
        )
        values (
          ${ctx.workspaceId}::uuid, ${investigationId}::uuid, 'user', ${input.content.trim()},
          'queued', ${input.intentHint}, ${input.clientMessageId}
        )
        returning id
      `;
      const messageId = String(messages[0]!.id);
      await this.insertJob(tx, ctx.workspaceId, investigationId, messageId, null, "assistant");
      await this.insertSystemEvent(tx, ctx.workspaceId, investigationId, messageId, null, {
        kind: "message_queued",
        messageId,
      });
      return investigationId;
    });
    return (await this.getInvestigation(ctx, id))!;
  }

  async getInvestigation(ctx: RequestContext, investigationId: string): Promise<InvestigationDetail | null> {
    const [investigations, messages, runs, results] = await Promise.all([
      this.sql<Row[]>`
        select investigation.*,
          (
            select run.status from public.investigation_runs run
            where run.investigation_id = investigation.id and run.status in ('queued', 'running')
            order by run.queued_at desc limit 1
          ) active_run_status,
          (
            select count(*) from (
              select distinct on (occurrence.opportunity_key) occurrence.accepted
              from public.opportunity_occurrences occurrence
              where occurrence.investigation_id = investigation.id
              order by occurrence.opportunity_key, occurrence.verified_at desc
            ) latest where latest.accepted
          ) proven_count
        from public.investigations investigation
        where investigation.id = ${investigationId}::uuid
          and investigation.workspace_id = ${ctx.workspaceId}::uuid
      `,
      this.sql<Row[]>`
        select * from public.investigation_messages
        where investigation_id = ${investigationId}::uuid and workspace_id = ${ctx.workspaceId}::uuid
        order by created_at, id
      `,
      this.sql<Row[]>`
        select * from public.investigation_runs
        where investigation_id = ${investigationId}::uuid and workspace_id = ${ctx.workspaceId}::uuid
        order by queued_at, id
      `,
      this.sql<Row[]>`
        select distinct on (opportunity_key) *
        from public.opportunity_occurrences
        where investigation_id = ${investigationId}::uuid and workspace_id = ${ctx.workspaceId}::uuid
        order by opportunity_key, verified_at desc
      `,
    ]);
    if (!investigations[0]) return null;
    return {
      ...this.summaryFrom(investigations[0]),
      messages: messages.map(messageFrom),
      runs: runs.map(runFrom),
      results: results.map(occurrenceFrom).sort((a, b) => b.impactMonthly - a.impactMonthly),
    };
  }

  async updateInvestigation(
    ctx: RequestContext,
    investigationId: string,
    patch: { title?: string; status?: InvestigationStatus },
  ): Promise<InvestigationDetail | null> {
    const existing = await this.getInvestigation(ctx, investigationId);
    if (!existing) return null;
    if (!canAdmin(ctx.role) && (ctx.role !== "member" || existing.createdBy !== ctx.userId)) {
      throw new RepositoryError("FORBIDDEN", "Only the creator or an administrator can update this investigation.");
    }
    await this.sql`
      update public.investigations
      set title = coalesce(${patch.title?.trim().slice(0, 120) || null}, title),
          status = coalesce(${patch.status ?? null}, status),
          updated_at = now()
      where id = ${investigationId}::uuid and workspace_id = ${ctx.workspaceId}::uuid
    `;
    await this.insertSystemEvent(this.sql, ctx.workspaceId, investigationId, null, null, {
      kind: "investigation_updated",
      investigationId,
    });
    return this.getInvestigation(ctx, investigationId);
  }

  async enqueueMessage(
    ctx: RequestContext,
    investigationId: string,
    input: { content: string; clientMessageId: string; intentHint: MessageIntent },
  ): Promise<InvestigationMessage> {
    if (!canWrite(ctx.role)) throw new RepositoryError("FORBIDDEN", "This workspace role cannot send messages.");
    return this.sql.begin(async (tx) => {
      const investigations = await tx<Row[]>`
        select id, status from public.investigations
        where id = ${investigationId}::uuid and workspace_id = ${ctx.workspaceId}::uuid
        for update
      `;
      if (!investigations[0]) throw new RepositoryError("NOT_FOUND", "Investigation not found.");
      if (investigations[0].status === "archived") throw new RepositoryError("CONFLICT", "Archived investigations are read-only.");
      const duplicate = await tx<Row[]>`
        select * from public.investigation_messages
        where investigation_id = ${investigationId}::uuid and client_message_id = ${input.clientMessageId}
      `;
      if (duplicate[0]) return messageFrom(duplicate[0]);
      const activeMessages = await tx<Row[]>`
        select 1 from public.investigation_messages
        where investigation_id = ${investigationId}::uuid and status in ('queued', 'running')
        limit 1
      `;
      if (activeMessages[0]) throw new RepositoryError("CONFLICT", "Wait for the active investigation turn to finish.");
      const active = await tx<Row[]>`
        select 1 from public.investigation_runs
        where investigation_id = ${investigationId}::uuid and status in ('queued', 'running')
        limit 1
      `;
      if (active[0]) throw new RepositoryError("CONFLICT", "Wait for the active run to finish or cancel it.");
      const rows = await tx<Row[]>`
        insert into public.investigation_messages (
          workspace_id, investigation_id, role, content, status, intent, client_message_id
        )
        values (
          ${ctx.workspaceId}::uuid, ${investigationId}::uuid, 'user', ${input.content.trim()},
          'queued', ${input.intentHint}, ${input.clientMessageId}
        )
        returning *
      `;
      const message = messageFrom(rows[0]!);
      await this.insertJob(tx, ctx.workspaceId, investigationId, message.id, null, "assistant");
      await this.insertSystemEvent(tx, ctx.workspaceId, investigationId, message.id, null, {
        kind: "message_queued",
        messageId: message.id,
      });
      await tx`
        update public.investigations set updated_at = now(), last_activity_at = now()
        where id = ${investigationId}::uuid
      `;
      return message;
    });
  }

  async listEvents(ctx: RequestContext, investigationId: string, after: number): Promise<InvestigationEventEnvelope[]> {
    const rows = await this.sql<Row[]>`
      select * from public.investigation_events
      where workspace_id = ${ctx.workspaceId}::uuid
        and investigation_id = ${investigationId}::uuid
        and id > ${after}
      order by id
      limit 500
    `;
    return rows.map(eventFrom);
  }

  async waitForInvestigationEvent(
    investigationId: string,
    signal: AbortSignal,
    timeoutMs: number,
  ): Promise<void> {
    let wake: (() => void) | null = null;
    const notified = new Promise<void>((resolve) => {
      wake = resolve;
    });
    const listener = await this.sql.listen("investigation_events", (payload) => {
      if (payload === investigationId) wake?.();
    });
    const onAbort = () => wake?.();
    signal.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => wake?.(), timeoutMs);
    try {
      await notified;
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      await listener.unlisten();
    }
  }

  async listWorkspaceEvents(ctx: RequestContext, limit = 200): Promise<InvestigationEventEnvelope[]> {
    const rows = await this.sql<Row[]>`
      select * from public.investigation_events
      where workspace_id = ${ctx.workspaceId}::uuid
      order by id desc
      limit ${Math.min(limit, 500)}
    `;
    return rows.map(eventFrom);
  }

  async listInsights(ctx: RequestContext): Promise<InsightRecord[]> {
    const rows = await this.sql<Row[]>`
      select subject, subject_type, claim, verdict, confidence, valid_until
      from public.workspace_insights
      where workspace_id = ${ctx.workspaceId}::uuid and valid_until > now()
      order by last_validated_at desc
    `;
    return rows.map((row) => ({
      subject: String(row.subject),
      subjectType: row.subject_type as InsightRecord["subjectType"],
      claim: String(row.claim),
      verdict: String(row.verdict),
      confidence: Number(row.confidence),
      validUntil: date(row.valid_until),
    }));
  }

  async listActivations(ctx: RequestContext): Promise<ActivationSummary[]> {
    const rows = await this.sql<Row[]>`
      select result, created_at
      from public.activations
      where workspace_id = ${ctx.workspaceId}::uuid
      order by created_at desc
    `;
    return rows.map((row) => {
      const result = json<ActivationResult>(row.result);
      return {
        opportunityKey: result.opportunity.key,
        title: result.opportunity.title,
        destination: result.sync?.destination ?? "-",
        audienceSize: result.audience.persuadableReach,
        upliftPp: result.measurement.upliftPp,
        pValue: result.measurement.pValue,
        verdict: result.measurement.verdict,
        status: "live",
        launchedAt: date(row.created_at).slice(0, 10),
      };
    });
  }

  async getLatestActivation(ctx: RequestContext): Promise<ActivationResult | null> {
    const rows = await this.sql<Row[]>`
      select result from public.activations
      where workspace_id = ${ctx.workspaceId}::uuid
      order by created_at desc
      limit 1
    `;
    return rows[0] ? json<ActivationResult>(rows[0].result) : null;
  }

  async recordActivation(
    ctx: RequestContext,
    occurrenceId: string,
    result: ActivationResult,
  ): Promise<void> {
    if (!canWrite(ctx.role)) throw new RepositoryError("FORBIDDEN", "This workspace role cannot activate results.");
    await this.sql.begin(async (tx) => {
      const rows = await tx<Row[]>`
        select occurrence.*
        from public.opportunity_occurrences occurrence
        join public.workspace_opportunities current
          on current.workspace_id = occurrence.workspace_id
          and current.opportunity_key = occurrence.opportunity_key
          and current.current_occurrence_id = occurrence.id
        where occurrence.id = ${occurrenceId}
          and occurrence.workspace_id = ${ctx.workspaceId}::uuid
          and occurrence.accepted
          and occurrence.valid_until > now()
        for update
      `;
      if (!rows[0]) throw new RepositoryError("CONFLICT", "This opportunity is not current.");
      await tx`
        insert into public.activations (
          workspace_id, investigation_id, run_id, occurrence_id, opportunity_key,
          created_by, status, result
        )
        values (
          ${ctx.workspaceId}::uuid, ${String(rows[0].investigation_id)}::uuid,
          ${String(rows[0].run_id)}::uuid, ${occurrenceId}, ${String(rows[0].opportunity_key)},
          ${ctx.userId}::uuid, 'live', ${tx.json(pgJson(result))}
        )
      `;
    });
  }

  async listOpportunities(ctx: RequestContext, filters: OpportunityFilters = {}): Promise<WorkspaceOpportunity[]> {
    const status = filters.status ?? "all";
    const query = filters.query?.trim() ? `%${filters.query.trim()}%` : null;
    const investigationId = filters.investigationId ?? null;
    const cursorImpact = filters.cursor?.impactMonthly ?? null;
    const cursorKey = filters.cursor?.key ?? null;
    const rows = await this.sql<Row[]>`
      select occurrence.*, current.occurrence_count,
        exists (
          select 1 from public.activations activation
          where activation.workspace_id = current.workspace_id
            and activation.occurrence_id = current.current_occurrence_id
            and activation.status = 'live'
        ) activation_live
      from public.workspace_opportunities current
      join public.opportunity_occurrences occurrence on occurrence.id = current.current_occurrence_id
      where current.workspace_id = ${ctx.workspaceId}::uuid
        and (
          ${status} = 'all'
          or (${status} = 'proven' and occurrence.accepted and occurrence.valid_until > now())
          or (${status} = 'stale' and occurrence.accepted and occurrence.valid_until <= now())
          or (${status} = 'superseded' and not occurrence.accepted)
        )
        and (
          ${investigationId}::uuid is null
          or occurrence.investigation_id = ${investigationId}::uuid
        )
        and (
          ${query}::text is null
          or occurrence.opportunity->>'title' ilike ${query}
          or occurrence.opportunity->>'segment' ilike ${query}
        )
        and (
          ${cursorImpact}::numeric is null
          or occurrence.impact_monthly < ${cursorImpact}
          or (
            occurrence.impact_monthly = ${cursorImpact}
            and occurrence.opportunity_key > ${cursorKey}
          )
        )
      order by occurrence.impact_monthly desc, occurrence.opportunity_key
      limit ${Math.min(filters.limit ?? 500, 500)}
    `;
    const now = Date.now();
    return rows
      .map((row): WorkspaceOpportunity => {
        const current = occurrenceFrom(row);
        return {
          key: current.opportunityKey,
          current,
          occurrenceCount: Number(row.occurrence_count),
          status: !current.accepted ? "superseded" : new Date(current.validUntil).getTime() <= now ? "stale" : "proven",
          activationStatus: row.activation_live ? "live" : null,
        };
      });
  }

  async getWorkspaceOpportunity(
    ctx: RequestContext,
    key: string,
  ): Promise<{ opportunity: WorkspaceOpportunity; history: OpportunityOccurrence[] } | null> {
    const [currentRows, historyRows] = await Promise.all([
      this.sql<Row[]>`
        select occurrence.*, current.occurrence_count,
          exists (
            select 1 from public.activations activation
            where activation.workspace_id = current.workspace_id
              and activation.occurrence_id = current.current_occurrence_id
              and activation.status = 'live'
          ) activation_live
        from public.workspace_opportunities current
        join public.opportunity_occurrences occurrence on occurrence.id = current.current_occurrence_id
        where current.workspace_id = ${ctx.workspaceId}::uuid and current.opportunity_key = ${key}
      `,
      this.sql<Row[]>`
        select * from public.opportunity_occurrences
        where workspace_id = ${ctx.workspaceId}::uuid and opportunity_key = ${key}
        order by verified_at desc
      `,
    ]);
    if (!currentRows[0]) return null;
    const current = occurrenceFrom(currentRows[0]);
    return {
      opportunity: {
        key,
        current,
        occurrenceCount: Number(currentRows[0].occurrence_count),
        status: !current.accepted
          ? "superseded"
          : new Date(current.validUntil).getTime() <= Date.now()
            ? "stale"
            : "proven",
        activationStatus: currentRows[0].activation_live ? "live" : null,
      },
      history: historyRows.map(occurrenceFrom),
    };
  }

  async claimJob(queue: JobRecord["queue"], workerId: string, leaseSeconds: number): Promise<JobRecord | null> {
    const rows = await this.sql<Row[]>`
      with queue_lock as (
        select case
          when ${queue} = 'engine'
          then pg_try_advisory_xact_lock(hashtextextended('lift-compass:engine-queue', 0))
          else true
        end as acquired
      ),
      candidate as (
        select job.id
        from public.jobs job
        cross join queue_lock
        where queue_lock.acquired
          and job.queue = ${queue}
          and (
            job.status = 'queued'
            or (job.status = 'leased' and job.lease_expires_at <= now())
          )
          and job.available_at <= now()
          and job.attempts < job.max_attempts
          and (
            ${queue} <> 'engine'
            or not exists (
              select 1
              from public.jobs active
              where active.queue = 'engine'
                and active.status = 'leased'
                and active.lease_expires_at > now()
            )
          )
        order by job.created_at
        for update skip locked
        limit 1
      )
      update public.jobs job
      set status = 'leased',
          worker_id = ${workerId},
          attempts = job.attempts + 1,
          lease_expires_at = now() + (${leaseSeconds} * interval '1 second'),
          updated_at = now()
      from candidate
      where job.id = candidate.id
      returning job.*
    `;
    return rows[0] ? jobFrom(rows[0]) : null;
  }

  async completeJob(jobId: string): Promise<void> {
    await this.sql`
      update public.jobs set status = 'completed', lease_expires_at = null, updated_at = now()
      where id = ${jobId}::uuid and status = 'leased'
    `;
  }

  async failJob(jobId: string, error: string): Promise<void> {
    await this.sql`
      update public.jobs
      set status = case when attempts >= max_attempts then 'failed' else 'queued' end,
          last_error = ${error},
          worker_id = null,
          lease_expires_at = null,
          available_at = now() + (least(30, power(2, attempts)) * interval '1 second'),
          updated_at = now()
      where id = ${jobId}::uuid
    `;
  }

  async heartbeatJob(jobId: string, workerId: string, leaseSeconds: number): Promise<void> {
    await this.sql`
      update public.jobs
      set lease_expires_at = now() + (${leaseSeconds} * interval '1 second'), updated_at = now()
      where id = ${jobId}::uuid and worker_id = ${workerId} and status = 'leased'
    `;
  }

  async getMessage(messageId: string): Promise<InvestigationMessage | null> {
    const rows = await this.sql<Row[]>`select * from public.investigation_messages where id = ${messageId}::uuid`;
    return rows[0] ? messageFrom(rows[0]) : null;
  }

  async getRun(runId: string): Promise<InvestigationRun | null> {
    const rows = await this.sql<Row[]>`select * from public.investigation_runs where id = ${runId}::uuid`;
    return rows[0] ? runFrom(rows[0]) : null;
  }

  async getRunCheckpointEvents(runId: string): Promise<EngineEvent[]> {
    const rows = await this.sql<Row[]>`
      select payload
      from public.run_checkpoints
      where run_id = ${runId}::uuid
      order by created_at, id
    `;
    return rows.map((row) => json<EngineEvent>(row.payload));
  }

  async getScopedResults(investigationId: string): Promise<OpportunityOccurrence[]> {
    const rows = await this.sql<Row[]>`
      select distinct on (opportunity_key) *
      from public.opportunity_occurrences
      where investigation_id = ${investigationId}::uuid
      order by opportunity_key, verified_at desc
    `;
    return rows.map(occurrenceFrom).sort((a, b) => b.impactMonthly - a.impactMonthly);
  }

  async completeAnswer(messageId: string, content: string, citations: string[]): Promise<void> {
    await this.sql.begin(async (tx) => {
      const inputs = await tx<Row[]>`
        update public.investigation_messages
        set status = 'complete', intent = 'answer'
        where id = ${messageId}::uuid
        returning workspace_id, investigation_id
      `;
      if (!inputs[0]) throw new RepositoryError("NOT_FOUND", "Message not found.");
      const replies = await tx<Row[]>`
        insert into public.investigation_messages (
          workspace_id, investigation_id, role, content, status, intent, citations
        )
        values (
          ${String(inputs[0].workspace_id)}::uuid, ${String(inputs[0].investigation_id)}::uuid,
          'assistant', ${content}, 'complete', 'answer', ${tx.json(pgJson(citations))}
        )
        returning id
      `;
      await this.insertSystemEvent(
        tx,
        String(inputs[0].workspace_id),
        String(inputs[0].investigation_id),
        String(replies[0]!.id),
        null,
        { kind: "message_answered", messageId: String(replies[0]!.id) },
      );
      await this.touch(tx, String(inputs[0].investigation_id));
    });
  }

  async completeClarification(messageId: string, question: string): Promise<void> {
    await this.sql.begin(async (tx) => {
      const inputs = await tx<Row[]>`
        update public.investigation_messages
        set status = 'complete', intent = 'clarify'
        where id = ${messageId}::uuid
        returning workspace_id, investigation_id
      `;
      if (!inputs[0]) throw new RepositoryError("NOT_FOUND", "Message not found.");
      const replies = await tx<Row[]>`
        insert into public.investigation_messages (
          workspace_id, investigation_id, role, content, status, intent
        )
        values (
          ${String(inputs[0].workspace_id)}::uuid, ${String(inputs[0].investigation_id)}::uuid,
          'assistant', ${question}, 'complete', 'clarify'
        )
        returning id
      `;
      await this.insertSystemEvent(
        tx,
        String(inputs[0].workspace_id),
        String(inputs[0].investigation_id),
        String(replies[0]!.id),
        null,
        { kind: "clarification_requested", messageId: String(replies[0]!.id) },
      );
      await this.touch(tx, String(inputs[0].investigation_id));
    });
  }

  async enqueueRun(messageId: string, context: InvestigationContextV1, goal: string): Promise<InvestigationRun> {
    return this.sql.begin(async (tx) => {
      const inputs = await tx<Row[]>`
        update public.investigation_messages
        set status = 'complete', intent = 'investigate'
        where id = ${messageId}::uuid
        returning workspace_id, investigation_id
      `;
      if (!inputs[0]) throw new RepositoryError("NOT_FOUND", "Message not found.");
      const workspaceId = String(inputs[0].workspace_id);
      const investigationId = String(inputs[0].investigation_id);
      const assistants = await tx<Row[]>`
        insert into public.investigation_messages (
          workspace_id, investigation_id, role, content, status, intent
        )
        values (${workspaceId}::uuid, ${investigationId}::uuid, 'assistant', 'Investigation queued…', 'queued', 'investigate')
        returning id
      `;
      const assistantId = String(assistants[0]!.id);
      const runs = await tx<Row[]>`
        insert into public.investigation_runs (
          workspace_id, investigation_id, input_message_id, assistant_message_id, goal, status, context
        )
        values (
          ${workspaceId}::uuid, ${investigationId}::uuid, ${messageId}::uuid, ${assistantId}::uuid,
          ${goal}, 'queued', ${tx.json(pgJson(context))}
        )
        returning *
      `;
      const run = runFrom(runs[0]!);
      await tx`
        update public.investigation_messages set run_id = ${run.id}::uuid
        where id in (${messageId}::uuid, ${assistantId}::uuid)
      `;
      await this.insertJob(tx, workspaceId, investigationId, assistantId, run.id, "engine");
      await this.insertSystemEvent(tx, workspaceId, investigationId, assistantId, run.id, {
        kind: "run_queued",
        runId: run.id,
        messageId: assistantId,
      });
      await this.touch(tx, investigationId);
      return run;
    });
  }

  async markRunRunning(runId: string): Promise<void> {
    await this.sql.begin(async (tx) => {
      const rows = await tx<Row[]>`
        update public.investigation_runs set status = 'running', started_at = now()
        where id = ${runId}::uuid and status = 'queued'
        returning workspace_id, assistant_message_id, investigation_id
      `;
      if (!rows[0]) return;
      await tx`
        update public.investigation_messages set status = 'running', content = 'Investigating…'
        where id = ${String(rows[0].assistant_message_id)}::uuid
      `;
      await this.touch(tx, String(rows[0].investigation_id));
    });
  }

  async appendEngineEvent(
    run: InvestigationRun,
    event: EngineEvent,
    dedupeKey: string,
  ): Promise<InvestigationEventEnvelope | null> {
    const rows = await this.sql<Row[]>`
      insert into public.investigation_events (
        workspace_id, investigation_id, message_id, run_id, event_dedupe_key, event
      )
        select workspace_id, investigation_id, assistant_message_id, id, ${dedupeKey}, ${this.sql.json(pgJson(event))}
      from public.investigation_runs
      where id = ${run.id}::uuid
      on conflict (run_id, event_dedupe_key) where run_id is not null do nothing
      returning *
    `;
    const checkpoint =
      event.kind === "hypothesis_proposed"
        ? {
            stage: "explorer",
            key: event.hypothesis?.key ?? event.text.slice(0, 120),
          }
        : event.kind === "planning" && event.text.startsWith("Planning the investigation")
          ? { stage: "explorer", key: "complete" }
          : event.kind === "candidate_verified"
            ? { stage: "candidate", key: event.key }
            : event.kind === "prioritizing"
              ? { stage: "ranking", key: "complete" }
              : null;
    if (checkpoint) {
      await this.sql`
        insert into public.run_checkpoints (workspace_id, run_id, stage, checkpoint_key, payload)
        select workspace_id, id, ${checkpoint.stage}, ${checkpoint.key}, ${this.sql.json(pgJson(event))}
        from public.investigation_runs where id = ${run.id}::uuid
        on conflict (run_id, stage, checkpoint_key)
        do update set payload = excluded.payload, updated_at = now()
      `;
    }
    return rows[0] ? eventFrom(rows[0]) : null;
  }

  async completeRun(runId: string, result: RunDetail): Promise<void> {
    await this.sql.begin(async (tx) => {
      const rows = await tx<Row[]>`
        select run.*, investigation.title
        from public.investigation_runs run
        join public.investigations investigation on investigation.id = run.investigation_id
        where run.id = ${runId}::uuid
        for update
      `;
      if (!rows[0]) throw new RepositoryError("NOT_FOUND", "Run not found.");
      if (rows[0].status === "completed") return;
      const workspaceId = String(rows[0].workspace_id);
      const investigationId = String(rows[0].investigation_id);
      const assistantId = String(rows[0].assistant_message_id);
      const title = String(rows[0].title);
      const completedAt = new Date();
      const validUntil = new Date(completedAt.getTime() + 90 * 86_400_000);
      const all = [...result.opportunities.ranked, ...result.opportunities.rejected];
      const citations: string[] = [];

      for (let index = 0; index < all.length; index++) {
        const opportunity = all[index]!;
        const occurrenceId = `${runId}:${opportunity.key}`;
        const verifiedAt = new Date(completedAt.getTime() + index);
        if (opportunity.accepted) citations.push(occurrenceId);
        await tx`
          insert into public.opportunity_occurrences (
            id, workspace_id, investigation_id, run_id, opportunity_key, accepted, verdict,
            impact_monthly, verified_at, valid_until, opportunity, source_investigation_title
          )
          values (
            ${occurrenceId}, ${workspaceId}::uuid, ${investigationId}::uuid, ${runId}::uuid,
            ${opportunity.key}, ${opportunity.accepted}, ${opportunity.verdict}, ${monthlyImpact(opportunity)},
            ${verifiedAt}, ${validUntil}, ${tx.json(pgJson(opportunity))}, ${title}
          )
          on conflict (run_id, opportunity_key) do nothing
        `;
        await tx`
          insert into public.workspace_opportunities (
            workspace_id, opportunity_key, current_occurrence_id, occurrence_count
          )
          values (${workspaceId}::uuid, ${opportunity.key}, ${occurrenceId}, 1)
          on conflict (workspace_id, opportunity_key)
          do update set
            current_occurrence_id = case
              when (
                select candidate.verified_at
                from public.opportunity_occurrences candidate
                where candidate.id = excluded.current_occurrence_id
              ) >= (
                select current_occurrence.verified_at
                from public.opportunity_occurrences current_occurrence
                where current_occurrence.id = public.workspace_opportunities.current_occurrence_id
              )
              then excluded.current_occurrence_id
              else public.workspace_opportunities.current_occurrence_id
            end,
            occurrence_count = public.workspace_opportunities.occurrence_count + 1,
            updated_at = now()
        `;
        await tx`
          update public.opportunity_occurrences occurrence
          set superseded_by_occurrence_id = current.current_occurrence_id
          from public.workspace_opportunities current
          where current.workspace_id = ${workspaceId}::uuid
            and current.opportunity_key = ${opportunity.key}
            and occurrence.workspace_id = current.workspace_id
            and occurrence.opportunity_key = current.opportunity_key
            and occurrence.id <> current.current_occurrence_id
        `;
        await tx`
          update public.opportunity_occurrences occurrence
          set superseded_by_occurrence_id = null
          from public.workspace_opportunities current
          where current.workspace_id = ${workspaceId}::uuid
            and current.opportunity_key = ${opportunity.key}
            and occurrence.id = current.current_occurrence_id
        `;
        const claim = opportunity.accepted
          ? `${opportunity.title}: verified ${opportunity.upliftPp == null ? "" : `+${opportunity.upliftPp.toFixed(1)}pp `}incremental lift`
          : `${opportunity.title}: ${opportunity.reason}`;
        await tx`
          insert into public.workspace_insights (
            workspace_id, subject, subject_type, claim, verdict, evidence, confidence,
            source_run_id, valid_until, last_validated_at
          )
          values (
            ${workspaceId}::uuid, ${opportunity.key},
            ${opportunity.type === "experiment" ? "campaign" : opportunity.type === "seasonality" ? "initiative" : "audience"},
            ${claim}, ${opportunity.verdict}, ${tx.json(pgJson(opportunity.evidence ?? {}))},
            ${opportunity.accepted ? 0.9 : 0.8}, ${runId}::uuid, ${validUntil}, ${verifiedAt}
          )
          on conflict (workspace_id, subject)
          do update set
            subject_type = excluded.subject_type,
            claim = excluded.claim,
            verdict = excluded.verdict,
            evidence = excluded.evidence,
            confidence = excluded.confidence,
            source_run_id = excluded.source_run_id,
            valid_until = excluded.valid_until,
            last_validated_at = excluded.last_validated_at
          where public.workspace_insights.last_validated_at <= excluded.last_validated_at
        `;
      }

      await tx`
        update public.investigation_runs
        set status = 'completed',
            result = ${tx.json(pgJson({ ...result, finishedAt: completedAt.toISOString() }))},
            cost_usd = ${result.costUsd ?? null},
            finished_at = ${completedAt}
        where id = ${runId}::uuid
      `;
      await tx`
        update public.jobs
        set status = 'completed', lease_expires_at = null, updated_at = now()
        where run_id = ${runId}::uuid and status in ('queued', 'leased')
      `;
      await tx`
        update public.investigation_messages
        set status = 'complete',
            content = ${`Done - ${result.opportunities.ranked.length} proven opportunities and ${result.opportunities.rejected.length} ruled out.`},
            citations = ${tx.json(pgJson(citations))}
        where id = ${assistantId}::uuid
      `;
      await tx`
        insert into public.investigation_events (
          workspace_id, investigation_id, message_id, run_id, event_dedupe_key, event
        )
        values (
          ${workspaceId}::uuid, ${investigationId}::uuid, ${assistantId}::uuid, ${runId}::uuid,
          'terminal:run_finished',
          ${tx.json(
            pgJson({
              kind: "run_finished",
              result: { ...result, finishedAt: completedAt.toISOString() },
            }),
          )}
        )
        on conflict (run_id, event_dedupe_key) where run_id is not null do nothing
      `;
      await this.touch(tx, investigationId);
    });
  }

  async failRun(runId: string, error: string): Promise<void> {
    await this.sql.begin(async (tx) => {
      const rows = await tx<Row[]>`
        update public.investigation_runs
        set status = 'failed', error = ${error}, finished_at = now()
        where id = ${runId}::uuid and status <> 'completed'
        returning workspace_id, assistant_message_id, investigation_id
      `;
      if (!rows[0]) return;
      await tx`
        update public.investigation_messages
        set status = 'error', error = ${error}, content = 'The investigation failed. You can retry the same request.'
        where id = ${String(rows[0].assistant_message_id)}::uuid
      `;
      await tx`
        insert into public.investigation_events (
          workspace_id, investigation_id, message_id, run_id, event_dedupe_key, event
        )
        values (
          ${String(rows[0].workspace_id)}::uuid,
          ${String(rows[0].investigation_id)}::uuid,
          ${String(rows[0].assistant_message_id)}::uuid,
          ${runId}::uuid,
          'terminal:run_failed',
          ${tx.json(pgJson({ kind: "error", message: error }))}
        )
        on conflict (run_id, event_dedupe_key) where run_id is not null do nothing
      `;
      await this.touch(tx, String(rows[0].investigation_id));
    });
  }

  async cancelRun(ctx: RequestContext, runId: string): Promise<InvestigationRun | null> {
    if (!canWrite(ctx.role)) throw new RepositoryError("FORBIDDEN", "This workspace role cannot cancel runs.");
    await this.sql.begin(async (tx) => {
      const rows = await tx<Row[]>`
        update public.investigation_runs
        set cancel_requested = true,
            status = case when status = 'queued' then 'cancelled' else status end,
            finished_at = case when status = 'queued' then now() else finished_at end
        where id = ${runId}::uuid and workspace_id = ${ctx.workspaceId}::uuid
        returning investigation_id, assistant_message_id, status
      `;
      if (!rows[0]) return;
      if (rows[0].status === "cancelled") {
        await tx`update public.jobs set status = 'cancelled' where run_id = ${runId}::uuid and status = 'queued'`;
        await tx`
          update public.investigation_messages set status = 'cancelled', content = 'Investigation cancelled.'
          where id = ${String(rows[0].assistant_message_id)}::uuid
        `;
        await this.insertSystemEvent(
          tx,
          ctx.workspaceId,
          String(rows[0].investigation_id),
          String(rows[0].assistant_message_id),
          runId,
          { kind: "run_cancelled", runId },
        );
      }
    });
    return this.getRun(runId);
  }

  async finalizeRunCancellation(runId: string): Promise<void> {
    await this.sql.begin(async (tx) => {
      const rows = await tx<Row[]>`
        update public.investigation_runs
        set cancel_requested = true, status = 'cancelled', finished_at = now()
        where id = ${runId}::uuid and status not in ('completed', 'cancelled')
        returning workspace_id, investigation_id, assistant_message_id
      `;
      if (!rows[0]) return;
      const workspaceId = String(rows[0].workspace_id);
      const investigationId = String(rows[0].investigation_id);
      const assistantMessageId = String(rows[0].assistant_message_id);
      await tx`
        update public.jobs
        set status = 'cancelled', lease_expires_at = null, updated_at = now()
        where run_id = ${runId}::uuid and status in ('queued', 'leased')
      `;
      await tx`
        update public.investigation_messages
        set status = 'cancelled', content = 'Investigation cancelled.'
        where id = ${assistantMessageId}::uuid
      `;
      await this.insertSystemEvent(
        tx,
        workspaceId,
        investigationId,
        assistantMessageId,
        runId,
        { kind: "run_cancelled", runId },
      );
      await this.touch(tx, investigationId);
    });
  }

  async createShare(
    ctx: RequestContext,
    investigationId: string,
    input: { tokenHash: string; snapshot: ShareSnapshotV1; expiresAt: string | null },
  ): Promise<ShareRecord> {
    if (!canWrite(ctx.role)) throw new RepositoryError("FORBIDDEN", "This workspace role cannot create shares.");
    const rows = await this.sql<Row[]>`
      insert into public.share_snapshots (
        workspace_id, investigation_id, created_by, token_hash, snapshot, expires_at
      )
      select workspace_id, id, ${ctx.userId}::uuid, ${input.tokenHash}, ${this.sql.json(pgJson(input.snapshot))},
        ${input.expiresAt == null ? null : new Date(input.expiresAt)}
      from public.investigations
      where id = ${investigationId}::uuid and workspace_id = ${ctx.workspaceId}::uuid
      returning *
    `;
    if (!rows[0]) throw new RepositoryError("NOT_FOUND", "Investigation not found.");
    return shareFrom(rows[0]);
  }

  async listShares(ctx: RequestContext, investigationId: string): Promise<ShareRecord[]> {
    const rows = canAdmin(ctx.role)
      ? await this.sql<Row[]>`
          select * from public.share_snapshots
          where workspace_id = ${ctx.workspaceId}::uuid and investigation_id = ${investigationId}::uuid
          order by created_at desc
        `
      : await this.sql<Row[]>`
          select * from public.share_snapshots
          where workspace_id = ${ctx.workspaceId}::uuid
            and investigation_id = ${investigationId}::uuid
            and created_by = ${ctx.userId}::uuid
          order by created_at desc
        `;
    return rows.map(shareFrom);
  }

  async getShareByHash(tokenHash: string): Promise<ShareRecord | null> {
    const rows = await this.sql<Row[]>`
      select * from public.share_snapshots where token_hash = ${tokenHash} limit 1
    `;
    return rows[0] ? shareFrom(rows[0]) : null;
  }

  async revokeShare(ctx: RequestContext, shareId: string): Promise<boolean> {
    const rows = canAdmin(ctx.role)
      ? await this.sql<Row[]>`
          update public.share_snapshots set revoked_at = now()
          where id = ${shareId}::uuid and workspace_id = ${ctx.workspaceId}::uuid
          returning id
        `
      : await this.sql<Row[]>`
          update public.share_snapshots set revoked_at = now()
          where id = ${shareId}::uuid and workspace_id = ${ctx.workspaceId}::uuid
            and created_by = ${ctx.userId}::uuid
          returning id
        `;
    return Boolean(rows[0]);
  }

  private summaryFrom(row: Row): InvestigationSummary {
    return {
      id: String(row.id),
      workspaceId: String(row.workspace_id),
      createdBy: String(row.created_by),
      title: String(row.title),
      objective: String(row.objective),
      status: row.status as InvestigationStatus,
      createdAt: date(row.created_at),
      updatedAt: date(row.updated_at),
      lastActivityAt: date(row.last_activity_at),
      activeRunStatus: row.active_run_status == null ? null : (row.active_run_status as InvestigationSummary["activeRunStatus"]),
      provenCount: Number(row.proven_count ?? 0),
    };
  }

  private async insertJob(
    sql: QuerySql,
    workspaceId: string,
    investigationId: string,
    messageId: string | null,
    runId: string | null,
    queue: JobRecord["queue"],
  ): Promise<void> {
    await sql`
      insert into public.jobs (workspace_id, investigation_id, message_id, run_id, queue, status)
      values (
        ${workspaceId}::uuid, ${investigationId}::uuid,
        ${messageId}::uuid, ${runId}::uuid, ${queue}, 'queued'
      )
    `;
  }

  private async insertSystemEvent(
    sql: QuerySql,
    workspaceId: string,
    investigationId: string,
    messageId: string | null,
    runId: string | null,
    event: InvestigationEventEnvelope["event"],
  ): Promise<void> {
    const dedupe = `${event.kind}:${messageId ?? runId ?? randomUUID()}`;
    await sql`
      insert into public.investigation_events (
        workspace_id, investigation_id, message_id, run_id, event_dedupe_key, event
      )
      values (
        ${workspaceId}::uuid, ${investigationId}::uuid, ${messageId}::uuid, ${runId}::uuid,
        ${dedupe}, ${sql.json(pgJson(event))}
      )
      on conflict do nothing
    `;
  }

  private async touch(sql: QuerySql, investigationId: string): Promise<void> {
    await sql`
      update public.investigations set updated_at = now(), last_activity_at = now()
      where id = ${investigationId}::uuid
    `;
  }
}
