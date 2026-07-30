import { z } from "zod";
import { apiError } from "@/server/api-response";
import { getRequestContext } from "@/server/auth";
import { getInvestigationRepository } from "@/server/investigations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    status: z.enum(["active", "archived"]).optional(),
  })
  .refine((input) => input.title != null || input.status != null, "No changes supplied.");

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
    return Response.json({ investigation });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ investigationId: string }> },
): Promise<Response> {
  try {
    const { investigationId } = await params;
    const patch = PatchSchema.parse(await req.json());
    const ctx = await getRequestContext();
    const repository = await getInvestigationRepository();
    const investigation = await repository.updateInvestigation(ctx, investigationId, patch);
    if (!investigation) return Response.json({ error: "Investigation not found.", code: "NOT_FOUND" }, { status: 404 });
    return Response.json({ investigation });
  } catch (error) {
    return apiError(error);
  }
}
