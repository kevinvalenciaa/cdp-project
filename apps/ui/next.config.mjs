import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Node-runtime server (not static export) so Route Handlers can run the engine.
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
  outputFileTracingRoot: repoRoot,
  // Native/Node-only packages used by the live engine must stay external (not bundled).
  serverExternalPackages: ["@lift/core", "@duckdb/node-api", "@modelcontextprotocol/sdk", "@anthropic-ai/sdk"],
};

export default nextConfig;
