import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
  run: {
    tasks: {
      // A release talks to EAS and GitHub: never replay it from the cache.
      apk: { command: "vpx ./src/main.ts apk", cache: false },
      store: { command: "vpx ./src/main.ts store", cache: false },
    },
  },
});
