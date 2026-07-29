import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/** OS-level reduce-motion preference; animations jump-cut when true. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (alive) setReduced(Boolean(v));
    });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (v) => setReduced(Boolean(v)));
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduced;
}
