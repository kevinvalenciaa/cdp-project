"use client";

import { useCallback, useRef, useState } from "react";

export type StreamStatus = "idle" | "streaming" | "done" | "error";

/** Consume an SSE endpoint imperatively (started on a user action). Terminal events
 *  are any with kind "error" or ending in "_finished". */
export function useEventStream<T extends { kind: string }>() {
  const [events, setEvents] = useState<T[]>([]);
  const [status, setStatus] = useState<StreamStatus>("idle");
  const esRef = useRef<EventSource | null>(null);

  const start = useCallback((url: string, onEvent?: (e: T) => void) => {
    esRef.current?.close();
    setEvents([]);
    setStatus("streaming");
    const es = new EventSource(url);
    esRef.current = es;
    es.onmessage = (m) => {
      let e: T;
      try {
        e = JSON.parse(m.data) as T;
      } catch {
        return;
      }
      setEvents((prev) => [...prev, e]);
      onEvent?.(e);
      if (e.kind === "error" || e.kind.endsWith("_finished")) {
        setStatus(e.kind === "error" ? "error" : "done");
        es.close();
      }
    };
    es.onerror = () => {
      setStatus((prev) => (prev === "done" ? prev : "error"));
      es.close();
    };
  }, []);

  const reset = useCallback(() => {
    esRef.current?.close();
    setEvents([]);
    setStatus("idle");
  }, []);

  return { events, status, start, reset };
}
