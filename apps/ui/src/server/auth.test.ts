import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

function setEnv(env: Record<string, string | undefined>): void {
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "DATABASE_URL", "LIFT_PUBLIC_DEMO", "NODE_ENV"]) {
    delete process.env[key];
  }
  Object.assign(process.env, env);
}

// getRequestContext pulls in next/headers, so exercise it through a fresh module
// graph per case with the Next request primitives stubbed out.
async function loadGetRequestContext() {
  vi.resetModules();
  vi.doMock("next/headers", () => ({
    cookies: async () => ({ get: () => undefined }),
  }));
  vi.doMock("next/navigation", () => ({
    redirect: (path: string) => {
      throw new Error(`REDIRECT:${path}`);
    },
  }));
  const mod = await import("./auth");
  return mod;
}

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("next/headers");
  vi.doUnmock("next/navigation");
  process.env = { ...ORIGINAL_ENV };
});

describe("getRequestContext environment gating", () => {
  it("serves the anonymous demo when nothing is configured outside production", async () => {
    setEnv({ NODE_ENV: "development" });
    const { getRequestContext } = await loadGetRequestContext();
    const ctx = await getRequestContext();
    expect(ctx.role).toBe("owner");
    expect(ctx.workspaceId).toBeTruthy();
  });

  it("refuses to serve anonymously in production without an explicit opt-in", async () => {
    // The dangerous case: a production deploy whose secrets failed to inject looks
    // exactly like the zero-config local demo, and used to silently go public.
    setEnv({ NODE_ENV: "production" });
    const { getRequestContext, AuthenticationError } = await loadGetRequestContext();
    await expect(getRequestContext()).rejects.toBeInstanceOf(AuthenticationError);
  });

  it("allows the anonymous demo in production when LIFT_PUBLIC_DEMO is set", async () => {
    setEnv({ NODE_ENV: "production", LIFT_PUBLIC_DEMO: "true" });
    const { getRequestContext } = await loadGetRequestContext();
    await expect(getRequestContext()).resolves.toMatchObject({ role: "owner" });
  });

  it("rejects a half-configured Supabase environment", async () => {
    setEnv({ NODE_ENV: "development", NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" });
    const { getRequestContext, AuthenticationError } = await loadGetRequestContext();
    await expect(getRequestContext()).rejects.toBeInstanceOf(AuthenticationError);
  });

  it("rejects a database without auth configured", async () => {
    setEnv({ NODE_ENV: "development", DATABASE_URL: "postgres://localhost/lift" });
    const { getRequestContext, AuthenticationError } = await loadGetRequestContext();
    await expect(getRequestContext()).rejects.toBeInstanceOf(AuthenticationError);
  });
});
