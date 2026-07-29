// Public API consumed by the product UI's live data provider.
export { runEngine, type EngineOpts } from "./engine/engine.js";
export { runEngineStreaming, type EngineStreamEvent } from "./engine/engine-streaming.js";
export type { Opportunity, EngineResult, Verdict, Hypothesis } from "./engine/types.js";
export type { Provenance, QueryProvenance, StatsProvenance } from "./engine/provenance.js";
export { activateOpportunity, type ActivationResult } from "./activation/activate.js";
export { applyFrequencyCap, type CapResult } from "./activation/caps.js";
export type { Rule } from "./guardrails/guard.js";
export { predicateToSql, type Predicate, type PredicateLeaf, type PredicateOp } from "./activation/predicate.js";
export type { AudienceDef } from "./activation/audience.js";
export type { Variant, SyncResult } from "./activation/connectors.js";
export { runBandit, SCENARIO, type BanditResult } from "./decisioning/bandit.js";
export { initPolicy, selectVariant, update, posteriorBest, type PolicyState } from "./decisioning/policy.js";
export { Memory, type InsightRecord, type SubjectType } from "./memory/store.js";
export { compileDecisionBundle, dataAnchorIso, DELIVERY_CAPS, FREQUENCY_CAP } from "./delivery/compile.js";
export { learnPosteriors } from "./delivery/posteriors.js";
export { bundlePath, etagOf, readBundle, writeBundle } from "./delivery/bundle-store.js";
export { connectWarehouse, connectStats } from "./harness/mcp-client.js";
