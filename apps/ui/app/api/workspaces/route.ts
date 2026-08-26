import { cookies } from "next/headers";
import { z } from "zod";
import { apiError } from "@/server/api-response";
import { getRequestContext } from "@/server/auth";
import { getInvestigationRepository } from "@/server/investigations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SelectWorkspaceSchema = z.object({
  workspaceId: z.string().uuid(),
});

export async function GET(): Promise<Response> {
  try {
    const ctx = await getRequestContext();
    const repository = await getInvestigationRepository();
    const workspaces = await repository.listWorkspaces(ctx.userId);
    // The sidebar identity block used to hardcode the demo account's email, so
    // every real signed-in user saw maria@fashionretailer.com in a multi-tenant
    // app. RequestContext has carried the real email all along.
    return Response.json({
      workspaces,
      selectedWorkspaceId: ctx.workspaceId,
      account: { email: ctx.email, role: ctx.role },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const input = SelectWorkspaceSchema.parse(await req.json());
    const ctx = await getRequestContext();
    const repository = await getInvestigationRepository();
    const memberships = await repository.listWorkspaces(ctx.userId);
    if (!memberships.some((workspace) => workspace.id === input.workspaceId)) {
      return Response.json(
        { error: "You are not a member of that workspace.", code: "FORBIDDEN" },
        { status: 403 },
      );
    }
    const cookieStore = await cookies();
    cookieStore.set("lift-workspace-id", input.workspaceId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return Response.json({ selectedWorkspaceId: input.workspaceId });
  } catch (error) {
    return apiError(error);
  }
}
