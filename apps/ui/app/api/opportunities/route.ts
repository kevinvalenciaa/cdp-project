import { z } from "zod";
import { apiError } from "@/server/api-response";
import { getRequestContext } from "@/server/auth";
import { decodeCursor, paginate, parsePageLimit } from "@/server/cursor";
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
    const limit = parsePageLimit(url.searchParams.get("limit"));
    const { items, nextCursor } = await paginate(
      limit,
      (take) =>
        repository.listOpportunities(ctx, {
          status,
          query: url.searchParams.get("q") ?? undefined,
          investigationId: url.searchParams.get("investigationId") ?? undefined,
          cursor: cursor ?? undefined,
          limit: take,
        }),
      (item) => ({ impactMonthly: item.current.impactMonthly, key: item.key }),
    );
    return Response.json({ opportunities: items, nextCursor });
  } catch (error) {
    return apiError(error);
  }
}
