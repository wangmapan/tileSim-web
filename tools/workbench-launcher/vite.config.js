import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const launcherRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: launcherRoot,
  base: "./",
  plugins: [vue()],
  clearScreen: false,
  envPrefix: ["VITE_", "TAURI_ENV_"],
  server: {
    host: "127.0.0.1",
    port: 4187,
    strictPort: true,
  },
  build: {
    target: "es2022",
    outDir: resolve(launcherRoot, "dist"),
    emptyOutDir: true,
    sourcemap: true,
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.{test,spec}.ts"],
    exclude: ["tests/e2e/**"],
  },
});
