import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
  // `vp run bundle`: the server as one JavaScript file, `dist/main.mjs`, for
  // the container image. Node won't strip the types of the workspace's
  // TypeScript packages once they're installed under `node_modules`, so they
  // are inlined; npm dependencies stay external.
  pack: {
    entry: ["src/main.ts"],
    platform: "node",
    deps: {
      alwaysBundle: ["bose-api-speaker-client"],
      onlyBundle: ["better-result"],
    },
  },
});
