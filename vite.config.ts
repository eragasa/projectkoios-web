import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const apiHost = process.env.KOIOS_API_HOST ?? "127.0.0.1";
const apiPort = process.env.KOIOS_API_PORT ?? "8000";
const apiTarget = `http://${apiHost}:${apiPort}`;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/docs": apiTarget,
      "/health": apiTarget,
      "/openapi.json": apiTarget,
      "/api/publications": apiTarget,
      "/citation-reviews": apiTarget,
      "/github/tasks": apiTarget,
      "/literature-review/progress": apiTarget,
      "/literature-review/references": apiTarget,
      "/search": {
        target: apiTarget,
        bypass: (request) => (request.method === "GET" ? "/index.html" : undefined),
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    exclude: ["tests/e2e/**", "node_modules/**", "dist/**"],
  },
});
