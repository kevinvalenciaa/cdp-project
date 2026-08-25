"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * A boolean that survives reloads. Renders the default first (SSR-safe), then
 * adopts the stored preference after hydration.
 */
export function usePersistedToggle(key: string, initial: boolean): [boolean, () => void] {
  const [on, setOn] = useState(initial);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored != null) setOn(stored === "1");
    } catch {
      /* private mode etc. - stay with the default */
    }
  }, [key]);

  const toggle = useCallback(() => {
    setOn((v) => {
      try {
        localStorage.setItem(key, v ? "0" : "1");
      } catch {
        /* non-fatal */
      }
      return !v;
    });
  }, [key]);

  return [on, toggle];
}
