import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "../shared/env.js";
import type { AudienceDef } from "./audience.js";

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
 * SIMULATED destination connector (reverse-ETL / activation — Hightouch's DNA). Writes an
 * audience-membership + payload artifact to disk. No real network calls, no real sends.
 */
export function syncToDestination(runId: string, audience: AudienceDef, brief: string, variants: Variant[]): SyncResult {
  const destination = DESTINATION_BY_CHANNEL[audience.channel] ?? "Meta Custom Audience";
  const dir = resolve(REPO_ROOT, "runs", runId, "activation");
  mkdirSync(dir, { recursive: true });
  const rel = `runs/${runId}/activation/${audience.channel}_sync.json`;
  writeFileSync(
    resolve(REPO_ROOT, rel),
    JSON.stringify(
      {
        simulated: true,
        note: "SIMULATED activation — no real network calls and no real messages were sent.",
        destination,
        audience_label: audience.label,
        audience_filter: `${audience.filter} AND ${audience.persuadableFilter}`,
        audience_size: audience.persuadableReach,
        sample_member_ids: audience.sampleMembers,
        creative_brief: brief,
        message_variants: variants,
      },
      null,
      2,
    ),
  );
  return { destination, simulated: true, membersSynced: audience.persuadableReach, artifactPath: rel };
}
