import { z } from "zod";
import { getProvider } from "@/server/data-provider";
import { sseResponse } from "@/server/sse";
import { getRequestContext } from "@/server/auth";
import { getInvestigationRepository } from "@/server/investigations";
import { canWrite } from "@/server/investigations/repository";
import { apiError } from "@/server/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ActivationQuerySchema = z.object({
  key: z.string().trim().min(1).max(200),
  occurrenceId: z.string().trim().min(1).max(500),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const { key, occurrenceId } = ActivationQuerySchema.parse({
      key: url.searchParams.get("key"),
      occurrenceId: url.searchParams.get("occurrenceId"),
    });
    const ctx = await getRequestContext();
    const repository = await getInvestigationRepository();
    if (!canWrite(ctx.role)) {
      return Response.json(
        { error: "This workspace role cannot activate results.", code: "FORBIDDEN" },
        { status: 403 },
      );
    }
    const current = await repository.getWorkspaceOpportunity(ctx, key);
    if (
      !current ||
      current.opportunity.current.id !== occurrenceId ||
      current.opportunity.status !== "proven"
    ) {
      return Response.json(
        {
          error: "This opportunity result is stale, rejected, or superseded.",
          code: "OPPORTUNITY_NOT_CURRENT",
        },
        { status: 409 },
      );
    }
    // Without this, re-approving a live opportunity streamed the whole launch
    // again and answered 200, while recordActivation silently did nothing - so
    // the UI raised "Launched" for a launch that never happened.
    if (current.opportunity.activationStatus === "live") {
      return Response.json(
        { error: "This opportunity is already live.", code: "ALREADY_ACTIVATED" },
        { status: 409 },
      );
    }
    const provider = await getProvider();
    const stream = provider.streamActivation(key, req.signal);
    async function* persistActivation() {
      for await (const event of stream) {
        if (event.kind === "act_finished") {
          await repository.recordActivation(ctx, occurrenceId, event.result);
        }
        yield event;
      }
    }
    return sseResponse(persistActivation(), req.signal);
  } catch (error) {
    return apiError(error);
  }
}
