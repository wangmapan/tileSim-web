import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 4173,
    strictPort: true,
    proxy: { "/api": "http://127.0.0.1:5173" },
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
