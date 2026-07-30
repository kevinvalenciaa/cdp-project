import { apiError } from "@/server/api-response";
import { getRequestContext } from "@/server/auth";
import { getInvestigationRepository } from "@/server/investigations";
import { abortActiveRun } from "@/server/investigations/worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ runId: string }> }): Promise<Response> {
  try {
    const { runId } = await params;
    const ctx = await getRequestContext();
    const repository = await getInvestigationRepository();
    const run = await repository.cancelRun(ctx, runId);
    if (!run) return Response.json({ error: "Run not found.", code: "NOT_FOUND" }, { status: 404 });
    abortActiveRun(runId);
    return Response.json({ run });
  } catch (error) {
    return apiError(error);
  }
}
