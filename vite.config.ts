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
    env: {
      browser: true,
    },
    categories: {
      correctness: "error",
      suspicious: "error",
      nursery: "error",
      restriction: "error",
      style: "error",
    },
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      "react/forbid-component-props": "off",
      "react/jsx-filename-extension": "off",
      "react/no-multi-comp": "off",
      "react/only-export-components": "off",
      "react/react-in-jsx-scope": "off",
      complexity: "off",
      "no-console": "error",
      "no-plusplus": "off",
      "no-undefined": "off",
      "no-use-before-define": "off",
      "no-void": "off",
      // Style rules
      "capitalized-comments": "off",
      "func-style": "off",
      "max-statements": "off",
      "new-cap": "off",
      "no-magic-numbers": "off",
      "no-ternary": "off",
      "prefer-destructuring": "off",
      "sort-keys": "off",
      "sort-imports": "off",
      "react/jsx-max-depth": "off",

      // TMP
      "init-declarations": "off",
      "react/hook-use-state": "off",
      "no-implicit-coercion": "off",
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
