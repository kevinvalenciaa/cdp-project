import { apiError } from "@/server/api-response";
import { getRequestContext } from "@/server/auth";
import { getInvestigationRepository } from "@/server/investigations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ shareId: string }> },
): Promise<Response> {
  try {
    const { shareId } = await params;
    const ctx = await getRequestContext();
    const repository = await getInvestigationRepository();
    const revoked = await repository.revokeShare(ctx, shareId);
    if (!revoked) return Response.json({ error: "Share not found.", code: "NOT_FOUND" }, { status: 404 });
    return new Response(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
}
