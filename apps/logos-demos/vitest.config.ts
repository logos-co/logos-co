/**
 * Vitest for `apps/logos-demos`.
 *
 * Pure-function lib tests only. Demo flows are verified in the browser.
 * Run with `pnpm --filter logos-demos test`.
 */
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/lib/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
