/**
 * End-to-end tests for `apps/logos-demos`.
 *
 * These cover the storage demo's full path: a real file through a real file
 * input, the CID the page works out, and the shared link round trip. The unit
 * tests check the CID against a node's answers; these check that a person
 * dropping a file actually gets that answer on screen.
 *
 * Run with `pnpm --filter logos-demos test:e2e`.
 */
import { defineConfig, devices } from '@playwright/test'

const PORT = 3005
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  // Hashing and a round trip through the store; the default 30s is tight on a
  // cold dev server.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm exec next dev --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
