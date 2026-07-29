"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type StreamStatus = "idle" | "streaming" | "done" | "error";

/** Consume an SSE endpoint imperatively (started on a user action). Terminal events
 *  are any with kind "error" or ending in "_finished". */
export function useEventStream<T extends { kind: string }>() {
  const [events, setEvents] = useState<T[]>([]);
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  // Without this, navigating away mid-run leaves the connection open and the server
  // generator producing events (and, in live mode, spending) for a page nobody is on.
  useEffect(() => {
    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, []);

  const start = useCallback((url: string, onEvent?: (e: T) => void) => {
    esRef.current?.close();
    setEvents([]);
    setError(null);
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
        if (e.kind === "error") {
          setStatus("error");
          setError((e as unknown as { message?: string }).message ?? "The run failed.");
        } else {
          setStatus("done");
        }
        es.close();
      }
    };

    es.onerror = () => {
      // EventSource fires onerror on normal close too, so only treat it as a failure
      // if we never reached a terminal event.
      setStatus((prev) => {
        if (prev === "done" || prev === "error") return prev;
        setError("Lost connection to the agent run.");
        return "error";
      });
      es.close();
    };
  }, []);

  const reset = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    setEvents([]);
    setError(null);
    setStatus("idle");
  }, []);

  return { events, status, error, start, reset };
}
