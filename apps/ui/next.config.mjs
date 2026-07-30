import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const SERVER_EXTERNALS = ["@lift/core", "@duckdb/node-api", "@duckdb/node-bindings", "@modelcontextprotocol/sdk", "@anthropic-ai/sdk"];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Node-runtime server (not static export) so Route Handlers can run the engine.
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
  outputFileTracingRoot: repoRoot,
  serverExternalPackages: SERVER_EXTERNALS,
  async headers() {
    return [
      {
        source: "/share/investigations/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
  webpack: (config, { isServer }) => {
    // Keep the engine + its native deps out of the bundle — required at runtime (Node 24
    // supports require(esm)). Prevents webpack from tracing into DuckDB's platform bindings.
    if (isServer) {
      config.externals = [...(config.externals ?? []), ...SERVER_EXTERNALS];
    }
    return config;
  },
};

export default nextConfig;
