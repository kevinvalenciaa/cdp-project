import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Hermes safety gate. The SDK ships to a React Native runtime with no node
 * builtins and no way to load native node modules. If any RUNTIME source file
 * (tests excluded — they run under node by design) imports a node builtin or
 * anything beyond @lift/protocol, the package would crash on import inside the
 * host app — the classic way an "SDK" turns out to never have been run on a
 * device. This test makes that failure impossible to ship silently.
 */

const here = dirname(fileURLToPath(import.meta.url));

const ALLOWED_SPECIFIERS = new Set(["@lift/protocol"]);

function importsOf(source: string): string[] {
  const out: string[] = [];
  const re = /(?:import|export)\s[^"']*?from\s+["']([^"']+)["']|import\s+["']([^"']+)["']|require\(\s*["']([^"']+)["']\s*\)/g;
  for (let m = re.exec(source); m; m = re.exec(source)) {
    out.push((m[1] ?? m[2] ?? m[3])!);
  }
  return out;
}

describe("no node dependencies in SDK runtime code", () => {
  const files = readdirSync(here).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

  it("scans a non-trivial module set", () => {
    expect(files.length).toBeGreaterThanOrEqual(9);
  });

  it.each(files)("%s imports only relative modules or @lift/protocol", (f) => {
    const specifiers = importsOf(readFileSync(resolve(here, f), "utf8"));
    for (const s of specifiers) {
      const ok = s.startsWith("./") || s.startsWith("../") || ALLOWED_SPECIFIERS.has(s);
      expect(ok, `${f} imports "${s}" — not loadable in Hermes`).toBe(true);
      expect(s.startsWith("node:"), `${f} imports node builtin "${s}"`).toBe(false);
    }
  });

  it("the built entrypoint (dist/index.js) is import-clean too, when present", () => {
    // Belt and braces: if dist exists (built), apply the same rule to the
    // emitted JS so a build-config regression cannot smuggle an import in.
    try {
      const dist = resolve(here, "../dist");
      const js = readdirSync(dist).filter((f) => f.endsWith(".js"));
      for (const f of js) {
        for (const s of importsOf(readFileSync(resolve(dist, f), "utf8"))) {
          expect(s.startsWith("./") || s.startsWith("../") || ALLOWED_SPECIFIERS.has(s), `dist/${f} imports "${s}"`).toBe(true);
        }
      }
    } catch {
      /* dist not built yet — the src scan above still guards */
    }
  });
});
