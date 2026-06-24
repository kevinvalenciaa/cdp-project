// Public API consumed by the product UI's live data provider.
export { runEngine } from "./engine/engine.js";
export { runEngineStreaming, type EngineStreamEvent } from "./engine/engine-streaming.js";
export type { Opportunity, EngineResult, Verdict } from "./engine/types.js";
export { activateOpportunity, type ActivationResult } from "./activation/activate.js";
export { runBandit, SCENARIO, type BanditResult } from "./decisioning/bandit.js";
export { Memory, type InsightRecord } from "./memory/store.js";
