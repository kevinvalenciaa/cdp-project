import { z } from "zod";
import { apiError } from "@/server/api-response";
import { getRequestContext } from "@/server/auth";
import { decodeCursor, paginate, parsePageLimit } from "@/server/cursor";
import { getInvestigationRepository } from "@/server/investigations";
import { kickInvestigationWorkers } from "@/server/investigations/worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  content: z.string().trim().min(3).max(4_000),
  clientMessageId: z.string().min(8).max(200),
  intentHint: z.enum(["auto", "answer", "investigate"]).default("auto"),
});
const CursorSchema = z.object({
  lastActivityAt: z.string().datetime(),
  id: z.string().uuid(),
});

export async function GET(req: Request): Promise<Response> {
  try {
    const ctx = await getRequestContext();
    const repository = await getInvestigationRepository();
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const limit = parsePageLimit(url.searchParams.get("limit"));
    const cursor = CursorSchema.nullable().parse(decodeCursor(url.searchParams.get("cursor")));
    const { items, nextCursor } = await paginate(
      limit,
      (take) =>
        repository.listInvestigations(ctx, {
          status: status === "active" || status === "archived" ? status : undefined,
          query: url.searchParams.get("q") ?? undefined,
          cursor: cursor ?? undefined,
          limit: take,
        }),
      (item) => ({ lastActivityAt: item.lastActivityAt, id: item.id }),
    );
    return Response.json({ investigations: items, nextCursor });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const input = CreateSchema.parse(await req.json());
    const ctx = await getRequestContext();
    const repository = await getInvestigationRepository();
    const investigation = await repository.createInvestigation(ctx, input);
    kickInvestigationWorkers();
    return Response.json({ investigation }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
