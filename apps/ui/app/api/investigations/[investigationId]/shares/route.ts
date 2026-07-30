import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import type { ShareSnapshotV1 } from "@/lib/investigations";
import { apiError } from "@/server/api-response";
import { getRequestContext } from "@/server/auth";
import { getInvestigationRepository } from "@/server/investigations";
import { redactShareText } from "@/server/share-redaction";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ShareSchema = z.object({
  scope: z.enum(["proven", "transcript", "full"]).default("proven"),
  expiresInDays: z.union([z.literal(7), z.literal(30), z.null()]).default(30),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ investigationId: string }> },
): Promise<Response> {
  try {
    const { investigationId } = await params;
    const ctx = await getRequestContext();
    const repository = await getInvestigationRepository();
    const shares = await repository.listShares(ctx, investigationId);
    return Response.json({
      shares: shares.map(({ tokenHash: _tokenHash, snapshot: _snapshot, ...share }) => share),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ investigationId: string }> },
): Promise<Response> {
  try {
    const { investigationId } = await params;
    const input = ShareSchema.parse(await req.json());
    const ctx = await getRequestContext();
    const repository = await getInvestigationRepository();
    const investigation = await repository.getInvestigation(ctx, investigationId);
    if (!investigation) return Response.json({ error: "Investigation not found.", code: "NOT_FOUND" }, { status: 404 });
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const opportunities = investigation.results
      .filter((result) => result.accepted || input.scope === "full")
      .map((result) => ({
        occurrenceId: result.id,
        key: result.opportunityKey,
        title: redactShareText(result.opportunity.title),
        segment: redactShareText(result.opportunity.segment),
        reason: redactShareText(result.opportunity.reason),
        impactMonthly: result.impactMonthly,
        upliftPp: result.opportunity.upliftPp,
        ci: result.opportunity.ci,
        pValue: result.opportunity.pValue,
        verdict: result.verdict,
        verifiedAt: result.verifiedAt,
      }));
    const snapshot: ShareSnapshotV1 = {
      version: 1,
      investigationId,
      title: redactShareText(investigation.title),
      objective: redactShareText(investigation.objective),
      asOf: new Date().toISOString(),
      scope: input.scope,
      opportunities,
      ...(input.scope === "transcript" || input.scope === "full"
        ? {
            transcript: investigation.messages
              .filter((message) => message.status === "complete")
              .map(({ role, content, createdAt }) => ({
                role,
                content: redactShareText(content),
                createdAt,
              })),
          }
        : {}),
    };
    const expiresAt =
      input.expiresInDays == null
        ? null
        : new Date(Date.now() + input.expiresInDays * 86_400_000).toISOString();
    const share = await repository.createShare(ctx, investigationId, { tokenHash, snapshot, expiresAt });
    const origin = process.env.APP_URL?.replace(/\/$/, "") || new URL(req.url).origin;
    return Response.json(
      {
        share: {
          id: share.id,
          url: `${origin}/share/investigations/${token}`,
          expiresAt: share.expiresAt,
          createdAt: share.createdAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
