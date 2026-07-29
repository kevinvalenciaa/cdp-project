import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DecisionBundleSchema, type DecisionBundle } from "@lift/protocol";
import { REPO_ROOT } from "../shared/env.js";

/**
 * Versioned bundle storage. The bundle_id is a content hash, so it doubles as
 * the ETag: same inputs -> same bytes -> same id -> 304 to every device that
 * already holds it.
 */

export function bundlePath(runId: string): string {
  return resolve(REPO_ROOT, "runs", runId, "delivery", "bundle.json");
}

export function writeBundle(runId: string, bundle: DecisionBundle): string {
  const path = bundlePath(runId);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(bundle, null, 2) + "\n");
  return path;
}

/** Read + schema-validate. A hand-edited or stale-schema bundle fails loudly here. */
export function readBundle(path: string): DecisionBundle {
  return DecisionBundleSchema.parse(JSON.parse(readFileSync(path, "utf8")));
}

export function etagOf(bundle: DecisionBundle): string {
  return bundle.bundle_id;
}
