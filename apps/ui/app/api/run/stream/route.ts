import { getProvider } from "@/server/data-provider";
import { sseResponse } from "@/server/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const goal = new URL(req.url).searchParams.get("goal")?.trim() || "Grow second purchases from one-time buyers";
  const provider = await getProvider();
  return sseResponse(provider.streamRun(goal, req.signal), req.signal);
}
