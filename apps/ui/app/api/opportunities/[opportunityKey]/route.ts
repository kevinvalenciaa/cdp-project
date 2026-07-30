import { apiError } from "@/server/api-response";
import { getRequestContext } from "@/server/auth";
import { getInvestigationRepository } from "@/server/investigations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ opportunityKey: string }> },
): Promise<Response> {
  try {
    const { opportunityKey } = await params;
    const ctx = await getRequestContext();
    const repository = await getInvestigationRepository();
    const result = await repository.getWorkspaceOpportunity(ctx, decodeURIComponent(opportunityKey));
    if (!result) return Response.json({ error: "Opportunity not found.", code: "NOT_FOUND" }, { status: 404 });
    return Response.json(result);
  } catch (error) {
    return apiError(error);
  }
}
