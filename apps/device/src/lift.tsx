import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { LiftCompass, type DebugState, type Decision } from "@lift/sdk";
import { storage } from "./storage";

/**
 * Host-side SDK wiring. The SDK instance is created once, provided via
 * context, and observed through its subscribe() hook. The host app never sees
 * a campaign rule — it asks decide(surface) and renders whatever comes back.
 */

const LiftContext = createContext<LiftCompass | null>(null);

// Simulator/device reach the dashboard over LAN; EXPO_PUBLIC_LIFT_API
// overrides (e.g. EXPO_PUBLIC_LIFT_API=http://192.168.1.20:3000).
const API_BASE = process.env.EXPO_PUBLIC_LIFT_API ?? "http://localhost:3000";

export function LiftProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [lift, setLift] = useState<LiftCompass | null>(null);

  useEffect(() => {
    let alive = true;
    let instance: LiftCompass | null = null;
    void LiftCompass.init({
      apiBase: API_BASE,
      storage,
      // Attributes of the demo shopper — a seeded one-time buyer who responds
      // to SMS, i.e. a member of the compiled bundle's audience.
      attrs: { is_one_time_buyer: true, sms_responder: true, categories_purchased: 1, value_tier: "mid" },
    }).then((sdk) => {
      if (!alive) return;
      instance = sdk;
      sdk.start();
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

/** Live debug state — re-renders on every SDK state change. */
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
 * anything) renders here. Re-decides when `visit` changes — screens bump it on
 * focus so every visit is a fresh decision (and a fresh ledger entry when the
 * message actually shows).
 */
export function useLiftMessage(surface: string, visit: number): SurfaceDecision | null {
  const lift = useLift();
  const [decision, setDecision] = useState<SurfaceDecision | null>(null);
  const pending = useRef(false);
  useEffect(() => {
    if (!lift || pending.current) return;
    pending.current = true;
    void lift.decide(surface).then((d) => {
      pending.current = false;
      setDecision(d);
    });
  }, [lift, surface, visit]);
  return decision;
}
