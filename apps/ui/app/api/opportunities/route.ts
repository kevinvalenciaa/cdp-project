import { z } from "zod";
import { apiError } from "@/server/api-response";
import { getRequestContext } from "@/server/auth";
import { decodeCursor, encodeCursor } from "@/server/cursor";
import { getInvestigationRepository } from "@/server/investigations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CursorSchema = z.object({
  impactMonthly: z.number(),
  key: z.string(),
});

export async function GET(req: Request): Promise<Response> {
  try {
    const ctx = await getRequestContext();
    const repository = await getInvestigationRepository();
    const url = new URL(req.url);
    const rawStatus = url.searchParams.get("status");
    const status =
      rawStatus === "proven" || rawStatus === "superseded" || rawStatus === "stale" || rawStatus === "all"
        ? rawStatus
        : "proven";
    const cursor = CursorSchema.nullable().parse(decodeCursor(url.searchParams.get("cursor")));
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50), 1), 100);
    const all = await repository.listOpportunities(ctx, {
      status,
      query: url.searchParams.get("q") ?? undefined,
      investigationId: url.searchParams.get("investigationId") ?? undefined,
      cursor: cursor ?? undefined,
      limit: limit + 1,
    });
    const opportunities = all.slice(0, limit);
    const last = opportunities.at(-1);
    return Response.json({
      opportunities,
      nextCursor:
        all.length > limit && last
          ? encodeCursor({
              impactMonthly: last.current.impactMonthly,
              key: last.key,
            })
          : null,
    });
  } catch (error) {
    return apiError(error);
  }
}
