import { z } from "zod";
import { apiError } from "@/server/api-response";
import { getRequestContext } from "@/server/auth";
import { getInvestigationRepository } from "@/server/investigations";
import { kickInvestigationWorkers } from "@/server/investigations/worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MessageSchema = z.object({
  content: z.string().trim().min(3).max(4_000),
  clientMessageId: z.string().min(8).max(200),
  intentHint: z.enum(["auto", "answer", "investigate"]).default("auto"),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ investigationId: string }> },
): Promise<Response> {
  try {
    const { investigationId } = await params;
    const input = MessageSchema.parse(await req.json());
    const ctx = await getRequestContext();
    const repository = await getInvestigationRepository();
    const message = await repository.enqueueMessage(ctx, investigationId, input);
    kickInvestigationWorkers();
    return Response.json({ message }, { status: 202 });
  } catch (error) {
    return apiError(error);
  }
}
