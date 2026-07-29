// pnpm-workspace Metro wiring: watch the repo root so rebuilds of
// @lift/sdk / @lift/protocol dist hot-reload, and resolve through both the
// app's node_modules and the root store (pnpm symlinks).
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const root = path.resolve(__dirname, "../..");
const config = getDefaultConfig(__dirname);
config.watchFolders = [root];
config.resolver.nodeModulesPaths = [path.join(__dirname, "node_modules"), path.join(root, "node_modules")];
module.exports = config;
