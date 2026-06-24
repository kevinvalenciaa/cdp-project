/** Turn an async generator of events into a Server-Sent Events streaming Response. */
export function sseResponse<T>(gen: AsyncGenerator<T>, signal: AbortSignal): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of gen) {
          if (signal.aborted) break;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        }
      } catch (err) {
        if (!signal.aborted) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ kind: "error", message: String(err) })}\n\n`));
        }
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
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
}
