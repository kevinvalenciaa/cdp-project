import { getProvider } from "@/server/data-provider";
import { sseResponse } from "@/server/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key")?.trim() || "";
  const provider = await getProvider();
  return sseResponse(provider.streamActivation(key, req.signal), req.signal);
}
