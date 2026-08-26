import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// Authorization in this app is per-handler: every route calls getRequestContext()
// itself. middleware.ts only refreshes the Supabase session - it gates nothing -
// so a handler that forgets the call is public by default. That is exactly how
// /api/run/stream shipped an unauthenticated endpoint that ran the LLM engine on
// an attacker-supplied goal. This test makes the omission fail CI instead.
//
// Only add to this list if the endpoint is genuinely anonymous by design, and say
// why - these three are the device/SDK loop and the readiness probe, all of which
// are polled by unauthenticated clients.
const INTENTIONALLY_PUBLIC = new Map([
  ["app/api/health/route.ts", "readiness probe; polled by Playwright and container healthchecks"],
  ["app/api/bundle/route.ts", "delivery bundle served to unauthenticated SDK devices (CORS *)"],
  ["app/api/ingest/route.ts", "delivery telemetry posted by unauthenticated SDK devices (CORS *)"],
]);

function findRoutes(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) findRoutes(full, acc);
    else if (entry === "route.ts") acc.push(full);
  }
  return acc;
}

describe("api route authorization", () => {
  const apiDir = join(process.cwd(), "app", "api");
  const routes = findRoutes(apiDir)
    .map((file) => relative(process.cwd(), file).split(sep).join("/"))
    .sort();

  it("finds the route handlers", () => {
    expect(routes.length).toBeGreaterThan(10);
  });

  it.each(routes)("%s either calls getRequestContext or is an allowlisted public endpoint", (route) => {
    const source = readFileSync(join(process.cwd(), route), "utf8");
    const guarded = source.includes("getRequestContext(");
    if (INTENTIONALLY_PUBLIC.has(route)) {
      expect(guarded, `${route} is allowlisted as public but now authenticates - remove it from INTENTIONALLY_PUBLIC`).toBe(false);
    } else {
      expect(guarded, `${route} does not call getRequestContext() and is not an allowlisted public endpoint`).toBe(true);
    }
  });

  it("has no stale entries in the public allowlist", () => {
    for (const route of INTENTIONALLY_PUBLIC.keys()) {
      expect(routes, `${route} is allowlisted as public but no longer exists`).toContain(route);
    }
  });
});
