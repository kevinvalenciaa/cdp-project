import { getProvider } from "@/server/data-provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Web-demo CORS: the device app served from Metro is a different origin. */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, If-None-Match",
  "Access-Control-Expose-Headers": "ETag, X-Server-Time",
};

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS });
}

/**
 * GET /api/bundle - the rules pushed DOWN to devices.
 *
 * The bundle_id is a content hash, so it doubles as the ETag: devices poll
 * with If-None-Match and pay for bytes only when the bundle actually changed.
 * Every response (200 AND 304) carries X-Server-Time - the SDK's clock-skew
 * anchor, at zero extra round trips.
 */
export async function GET(req: Request): Promise<Response> {
  const provider = await getProvider();
  const serverTime = new Date().toISOString();
  const entry = await provider.getBundle();
  if (!entry) {
    return Response.json(
      { error: "no bundle compiled yet - run the engine (or generate the demo fixture) first" },
      { status: 404, headers: { ...CORS, "X-Server-Time": serverTime } },
    );
  }
  const inm = req.headers.get("If-None-Match");
  if (inm && inm === entry.etag) {
    return new Response(null, { status: 304, headers: { ...CORS, ETag: entry.etag, "X-Server-Time": serverTime } });
  }
  return Response.json(
    { bundle: entry.bundle, server_time: serverTime },
    { headers: { ...CORS, ETag: entry.etag, "X-Server-Time": serverTime, "Cache-Control": "no-cache" } },
  );
}
