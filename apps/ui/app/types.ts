export interface Opportunity {
  key: string;
  title: string;
  segment: string;
  type: string;
  reach: number;
  value: number;
  rawConversion: number | null;
  upliftPp: number | null;
  ci: [number, number] | null;
  pValue: number | null;
  verdict: string;
  accepted: boolean;
  score: number;
  reason: string;
  bareLlm?: { accepted: boolean; reason: string };
}

export interface Board {
  generatedAtSeed: number;
  goal: string;
  opportunities: { ranked: Opportunity[]; rejected: Opportunity[] };
  activation: {
    opportunity: Opportunity;
    audience: { label: string; channel: string; reach: number; persuadableReach: number; persuadableFilter: string; sampleMembers: number[] };
    brief: string;
    variants: { id: string; channel: string; text: string }[];
    guardrail: { allowed: boolean };
    sync: { destination: string; membersSynced: number; artifactPath: string } | null;
    measurement: { treatmentN: number; controlN: number; treatmentConv: number; controlConv: number; upliftPp: number; ci: [number, number]; pValue: number; verdict: string };
    memoryWritten: boolean;
  };
  bandit: {
    impressions: number;
    learnedBest: string[];
    oracleBest: string[];
    converged: boolean;
    banditRate: number;
    randomRate: number;
    globalBestRate: number;
    oracleRate: number;
    liftVsHoldout: number;
    liftVsGlobalBest: number;
    globalBestVariant: string;
  };
}

export const SEGMENTS = ["vip", "mid", "low"];
