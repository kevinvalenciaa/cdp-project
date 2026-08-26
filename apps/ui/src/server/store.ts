import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { ActivationSummary, EngineEvent, RunDetail } from "@/lib/types";

/** Minimal single-user persistence for live mode - a JSON file under repo/runs/. */
const STATE_PATH = resolve(process.cwd(), "../../runs/app-state.json");

interface AppState {
  latestRun: RunDetail | null;
  latestActivity: EngineEvent[];
  activations: ActivationSummary[];
}

function read(): AppState {
  try {
    return JSON.parse(readFileSync(STATE_PATH, "utf8")) as AppState;
  } catch {
    return { latestRun: null, latestActivity: [], activations: [] };
  }
}

function write(state: AppState): void {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(state));
}

export const store = {
  getLatestRun: () => read().latestRun,
  getActivity: () => read().latestActivity,
  listActivations: () => read().activations,
  saveRun(run: RunDetail, activity: EngineEvent[]) {
    const s = read();
    write({ ...s, latestRun: run, latestActivity: activity });
  },
  addActivation(a: ActivationSummary) {
    const s = read();
    const activations = [a, ...s.activations.filter((x) => x.opportunityKey !== a.opportunityKey)];
    write({ ...s, activations });
  },
};
