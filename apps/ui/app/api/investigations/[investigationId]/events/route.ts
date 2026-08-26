import { apiError } from "@/server/api-response";
import { getRequestContext } from "@/server/auth";
import { getInvestigationRepository } from "@/server/investigations";
import { kickInvestigationWorkers } from "@/server/investigations/worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** How often the stream re-pumps the queues while a client is watching. */
const PUMP_INTERVAL_MS = 2_000;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ investigationId: string }> },
): Promise<Response> {
  try {
    const { investigationId } = await params;
    const ctx = await getRequestContext();
    const repository = await getInvestigationRepository();
    // Existence check only - getInvestigation loads every message and every run's
    // context and result JSONB, and EventSource reconnects on any network blip.
    if (!(await repository.investigationExists(ctx, investigationId))) {
      return Response.json({ error: "Investigation not found.", code: "NOT_FOUND" }, { status: 404 });
    }
    const url = new URL(req.url);
    let cursor = Number(req.headers.get("Last-Event-ID") ?? url.searchParams.get("after") ?? 0);
    if (!Number.isFinite(cursor) || cursor < 0) cursor = 0;
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let heartbeatAt = Date.now();
        let pumpedAt = 0;
        try {
          while (!req.signal.aborted) {
            // Keep the queues moving for as long as someone is watching.
            //
            // The POST handlers kick the workers and return immediately, which is
            // fine on a long-lived server but not on a platform that suspends the
            // instance the moment a response is flushed - there the drain never
            // ran and the investigation sat "queued" forever with no error. This
            // stream is held open by the client for exactly the period the work
            // needs, so pumping from here is what makes the create -> run ->
            // results loop complete without a separate worker process. Idempotent
            // and cheap when a worker is already draining.
            if (Date.now() - pumpedAt >= PUMP_INTERVAL_MS) {
              pumpedAt = Date.now();
              kickInvestigationWorkers();
            }
            const events = await repository.listEvents(ctx, investigationId, cursor);
            for (const event of events) {
              cursor = Math.max(cursor, event.id);
              controller.enqueue(encoder.encode(`id: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`));
            }
            if (Date.now() - heartbeatAt >= 15_000) {
              controller.enqueue(encoder.encode(`: heartbeat\n\n`));
              heartbeatAt = Date.now();
            }
            if (events.length > 0) {
              await new Promise((resolve) => setTimeout(resolve, 50));
            } else if (repository.waitForInvestigationEvent) {
              await repository.waitForInvestigationEvent(investigationId, req.signal, 1_000);
            } else {
              await new Promise((resolve) => setTimeout(resolve, 750));
            }
          }
        } catch (error) {
          if (!req.signal.aborted) controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ message: String(error) })}\n\n`));
        } finally {
          try {
            controller.close();
          } catch {
            // Already closed by the client.
          }
        }
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
