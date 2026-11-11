import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests. They run against `next dev` backed by a throwaway local Postgres ("pemart_e2e", see
 * scripts/e2e.sh) with the simulated Paystack popup and the dev-only login route, so no real payments or accounts are needed.
 * Run: npm run test:e2e
 */
const PORT = Number(process.env.E2E_PORT ?? 3200);
const DB = process.env.E2E_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/pemart_e2e';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 900 },
    trace: 'off',
    navigationTimeout: 90_000,
    actionTimeout: 45_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } }],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 180_000,
    env: {
      DATABASE_URL: DB,
      PAYSTACK_MOCK: '1',
      PAYSTACK_SECRET_KEY: 'sk_test_e2e',
      CRON_SECRET: 'cron-secret',
      NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
      NEXT_PUBLIC_GA_ID: 'G-E2ETEST',
      NEXT_PUBLIC_META_PIXEL_ID: '1234567890',
    },
  },
});
