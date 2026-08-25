import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { LiftCompass, type DebugState, type Decision } from "@lift/sdk";
import { storage } from "./storage";

/**
 * Host-side SDK wiring. The SDK instance is created once, provided via
 * context, and observed through its subscribe() hook. The host app never sees
 * a campaign rule - it asks decide(surface) and renders whatever comes back.
 */

const LiftContext = createContext<LiftCompass | null>(null);

// Simulator/device reach the dashboard over LAN; EXPO_PUBLIC_LIFT_API
// overrides (e.g. EXPO_PUBLIC_LIFT_API=http://192.168.1.20:3000).
const API_BASE = process.env.EXPO_PUBLIC_LIFT_API ?? "http://localhost:3000";

/**
 * One SDK instance per app, module-scoped. React StrictMode double-mounts
 * effects in dev; two LiftCompass instances would double-count deliveries in
 * the shared ledger (the first delivers, the remounted one immediately sees
 * the cap as spent). An SDK is a singleton in a real host app too.
 */
let sdkPromise: Promise<LiftCompass> | null = null;
function getSdk(): Promise<LiftCompass> {
  sdkPromise ??= LiftCompass.init({
    apiBase: API_BASE,
    storage,
    // Attributes of the demo shopper - a seeded one-time buyer who responds
    // to SMS, i.e. a member of the compiled bundle's audience.
    attrs: { is_one_time_buyer: true, sms_responder: true, categories_purchased: 1, value_tier: "mid" },
  });
  return sdkPromise;
}

export function LiftProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [lift, setLift] = useState<LiftCompass | null>(null);

  useEffect(() => {
    let alive = true;
    let instance: LiftCompass | null = null;
    void getSdk().then((sdk) => {
      if (!alive) return;
      instance = sdk;
      sdk.start(); // idempotent - safe across StrictMode remounts
      setLift(sdk);
    });
    return () => {
      alive = false;
      instance?.stop();
    };
  }, []);

  return <LiftContext.Provider value={lift}>{children}</LiftContext.Provider>;
}

export function useLift(): LiftCompass | null {
  return useContext(LiftContext);
}

/** Live debug state - re-renders on every SDK state change. */
export function useLiftDebug(): DebugState | null {
  const lift = useLift();
  const [state, setState] = useState<DebugState | null>(null);
  useEffect(() => {
    if (!lift) return;
    setState(lift.debugState());
    return lift.subscribe(() => setState(lift.debugState()));
  }, [lift]);
  return state;
}

export type SurfaceDecision = Decision | { outcome: "no_bundle"; surface: string; reason: string };

/**
 * The host integration point for a message surface: ask the SDK what (if
 * anything) renders here. Re-decides when `visit` changes - screens bump it on
 * focus so every visit is a fresh decision (and a fresh ledger entry when the
 * message actually shows).
 *
 * First-load race: if decide() runs before the initial bundle fetch resolves,
 * the answer is "no_bundle". The hook subscribes to the SDK and re-decides
 * once for the same visit when the bundle lands - so a surface never stays
 * blank just because the network was slower than the first render.
 */
export function useLiftMessage(surface: string, visit: number): SurfaceDecision | null {
  const lift = useLift();
  const [decision, setDecision] = useState<SurfaceDecision | null>(null);
  const pending = useRef(false);
  // decide() records a delivery in the frequency ledger, so it must run exactly
  // ONCE per (surface, visit) - StrictMode's simulated remount re-runs effects
  // but preserves refs, so this key is the idempotency guard.
  const decidedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!lift) return;
    const key = `${surface}:${visit}`;

    const decide = (): void => {
      if (pending.current) return;
      pending.current = true;
      void lift.decide(surface).then((d) => {
        pending.current = false;
        setDecision(d);
      });
    };

    if (decidedFor.current !== key) {
      decidedFor.current = key;
      decide();
    }
    // Retry-on-bundle-arrival: only relevant while the answer is "no bundle yet".
    const unsubscribe = lift.subscribe(() => {
      setDecision((current) => {
        if (current?.outcome === "no_bundle" && lift.debugState().bundleId) decide();
        return current;
      });
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lift, surface, visit]);

  return decision;
}
