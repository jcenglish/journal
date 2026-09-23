import react from '@vitejs/plugin-react'
// vitest/config re-exports Vite's defineConfig with the `test` key typed.
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Keeps the browser on a single origin in dev, so the Rails session cookie
      // works with SameSite=Lax and no CORS at all. Rails owns the /api prefix,
      // so there's no rewrite here to drift out of sync with a production proxy.
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Left at the default (false) on purpose: test files import describe/it/expect
    // explicitly, which keeps both tsconfig and eslint.config.js free of
    // test-runner-specific globals config.
    globals: false,
  },
})
