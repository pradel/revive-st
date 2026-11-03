/* eslint-disable */
// @ts-nocheck
const { getPostHogExpoConfig } = require("posthog-react-native/metro");
const path = require("path");

// Find the project and workspace directories
const projectRoot = __dirname;
// This can be replaced with `find-yarn-workspace-root`
const workspaceRoot = path.resolve(projectRoot, "../..");

// Expo's default config, with the ids PostHog matches crash stack traces to
// their uploaded source maps by.
const config = getPostHogExpoConfig(projectRoot);

// 1. Watch all files within the monorepo
config.watchFolders = [workspaceRoot];
// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

module.exports = config;
