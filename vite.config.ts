import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    printWidth: 80,
    sortImports: true,
  },
  lint: {
    options: { typeAware: true, typeCheck: true },
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    plugins: ["react"],
    categories: {
      correctness: "error",
      suspicious: "error",
    },
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      "react/react-in-jsx-scope": "off",
      "no-console": "error",
    },
    overrides: [
      {
        files: ["apps/app/src/lib/logger.ts"],
        rules: { "no-console": "off" },
      },
      {
        files: ["packages/**/*.ts"],
        rules: { "no-console": "off" },
      },
    ],
  },
  run: {
    cache: true,
  },
});
