import { nitro } from "nitro/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [nitro()],
  preview: {
    allowedHosts: ["api.revivest.app"],
  },
});
