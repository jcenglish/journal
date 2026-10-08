import react from "@vitejs/plugin-react";
// vitest/config re-exports Vite's defineConfig with the `test` key typed.
import { defineConfig } from "vitest/config";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Keeps the browser on a single origin in dev, so the Rails session cookie
      // works with SameSite=Lax and no CORS at all. Rails owns the /api prefix,
      // so there's no rewrite here to drift out of sync with a production proxy.
      "/api": { target: "http://localhost:3000", changeOrigin: true },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    // Left at the default (false) on purpose: test files import describe/it/expect
    // explicitly, which keeps both tsconfig and eslint.config.js free of
    // test-runner-specific globals config.
    globals: false,
    coverage: {
      provider: "v8",
      // Without this, files no test imports are left out of the report and
      // can't pull the numbers down.
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/test/**", "src/**/*.d.ts"],
      // Set below the measured baseline (about 94% statements, 86% branches), so
      // a real regression fails CI but a small change doesn't. Raise as
      // coverage grows.
      thresholds: {
        statements: 90,
        lines: 90,
        functions: 88,
        branches: 80,
      },
    },
  },
});
