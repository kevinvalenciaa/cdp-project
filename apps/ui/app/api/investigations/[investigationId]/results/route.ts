import { apiError } from "@/server/api-response";
import { getRequestContext } from "@/server/auth";
import { getInvestigationRepository } from "@/server/investigations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ investigationId: string }> },
): Promise<Response> {
  try {
    const { investigationId } = await params;
    const ctx = await getRequestContext();
    const repository = await getInvestigationRepository();
    const investigation = await repository.getInvestigation(ctx, investigationId);
    if (!investigation) return Response.json({ error: "Investigation not found.", code: "NOT_FOUND" }, { status: 404 });
    return Response.json({ results: investigation.results });
  } catch (error) {
    return apiError(error);
  }
}
