import { ZodError } from "zod";
import { getProvider } from "@/server/data-provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/ingest — device event batches shipped UP.
 *
 * Durable and idempotent: one file per batch, existence is the dedupe index,
 * so an SDK retrying a sealed batch after a network failure is absorbed with
 * duplicate=true and no reprocessing. X-Server-Time on every response keeps
 * the device's skew anchor fresh.
 */
export async function POST(req: Request): Promise<Response> {
  const provider = await getProvider();
  const serverTime = new Date().toISOString();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "body is not JSON" }, { status: 400, headers: { "X-Server-Time": serverTime } });
  }
  try {
    const ack = await provider.ingest(body as never);
    return Response.json(ack, { headers: { "X-Server-Time": ack.server_time } });
  } catch (err) {
    if (err instanceof ZodError) {
      const i = err.issues[0];
      return Response.json(
        { error: `invalid EventBatch — ${i ? `${i.path.join(".")}: ${i.message}` : "schema mismatch"}` },
        { status: 422, headers: { "X-Server-Time": serverTime } },
      );
    }
    return Response.json({ error: String(err) }, { status: 500, headers: { "X-Server-Time": serverTime } });
  }
}
