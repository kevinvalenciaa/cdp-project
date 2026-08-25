import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "../shared/env.js";
import type { AudienceDef } from "./audience.js";
import type { CapResult } from "./caps.js";

export interface Variant {
  id: string;
  channel: string;
  text: string;
}

export interface SyncResult {
  destination: string;
  simulated: true;
  membersSynced: number;
  artifactPath: string;
}

const DESTINATION_BY_CHANNEL: Record<string, string> = {
  sms: "Braze (SMS journey)",
  email: "Braze (Email)",
  push: "Braze (Push)",
};

/**
 * SIMULATED destination connector for reverse ETL and activation. Writes an
 * audience-membership + payload artifact to disk. No real network calls, no real sends.
 */
export function syncToDestination(runId: string, audience: AudienceDef, brief: string, variants: Variant[], cap: CapResult): SyncResult {
  const destination = DESTINATION_BY_CHANNEL[audience.channel] ?? "Meta Custom Audience";
  const dir = resolve(REPO_ROOT, "runs", runId, "activation");
  mkdirSync(dir, { recursive: true });
  const rel = `runs/${runId}/activation/${audience.channel}_sync.json`;
  const membersSynced = audience.persuadableReach - cap.excluded;
  writeFileSync(
    resolve(REPO_ROOT, rel),
    JSON.stringify(
      {
        simulated: true,
        note: "SIMULATED activation - no real network calls and no real messages were sent.",
        destination,
        audience_label: audience.label,
        audience_filter: `${audience.filterSql} AND ${audience.persuadableSql}`,
        audience_predicate: { all: [audience.filter, audience.persuadableFilter] },
        audience_size: membersSynced,
        frequency_cap: {
          rule_id: cap.ruleId,
          window_days: cap.windowDays,
          max_sends: cap.maxSends,
          excluded: cap.excluded,
          anchor: cap.anchor,
        },
        sample_member_ids: audience.sampleMembers,
        creative_brief: brief,
        message_variants: variants,
      },
      null,
      2,
    ),
  );
  return { destination, simulated: true, membersSynced, artifactPath: rel };
}
