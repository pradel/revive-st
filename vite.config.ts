import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {},
  lint: {
    options: { typeAware: true, typeCheck: true },
    categories: {
      correctness: "error",
      suspicious: "error",
    },
  },
  run: {
    cache: true,
  },
});
