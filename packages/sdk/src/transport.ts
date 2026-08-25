import { IngestAckSchema, decodeBundle, type DecodedBundle, type EventBatch, type IngestAck } from "@lift/protocol";

/**
 * The network edge. Every response carries the server's clock (X-Server-Time
 * header and/or server_time in the body) - that is the SDK's skew anchor, and
 * it costs zero extra round trips.
 */

export interface BundleFetch {
  status: 200 | 304;
  decoded: DecodedBundle | null;
  etag: string | null;
  serverTime: string | null;
}

export async function fetchBundle(apiBase: string, etag: string | null): Promise<BundleFetch> {
  const res = await fetch(`${apiBase}/api/bundle`, {
    headers: etag ? { "If-None-Match": etag } : {},
  });
  const serverTime = res.headers.get("X-Server-Time");
  if (res.status === 304) {
    return { status: 304, decoded: null, etag, serverTime };
  }
  if (!res.ok) throw new Error(`bundle fetch failed: ${res.status}`);
  const body = (await res.json()) as { bundle?: unknown; server_time?: string };
  const decoded = decodeBundle(body.bundle ?? body);
  return {
    status: 200,
    decoded,
    etag: res.headers.get("ETag") ?? decoded.bundle.bundle_id,
    serverTime: serverTime ?? body.server_time ?? null,
  };
}

export interface IngestResult {
  ack: IngestAck;
  serverTime: string | null;
}

export async function postBatch(apiBase: string, batch: EventBatch): Promise<IngestResult> {
  const res = await fetch(`${apiBase}/api/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(batch),
  });
  if (!res.ok) throw new Error(`ingest failed: ${res.status}`);
  const ack = IngestAckSchema.parse(await res.json());
  return { ack, serverTime: res.headers.get("X-Server-Time") ?? ack.server_time };
}
