import { defineConfig, devices } from '@playwright/test';

/**
 * HaulFlow End-to-End Test Configuration
 *
 * Tests run against the live production app at haulflow.vercel.app.
   * The API server is at the same origin (Railway-hosted Express).
 *
 * To run:
 *   cd e2e
 *   npm install
 *   npx playwright install chromium
 *   npm test
 *
 * Environment variables (optional):
 *   BASE_URL   - override the target URL (default: https://haulflow.vercel.app)
 *   API_URL    - override the API URL  (default: same as BASE_URL)
   */

const BASE_URL = process.env.BASE_URL || 'https://haulflow.vercel.app';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,   // run sequentially — tests share state (created company)
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
},

  projects: [
{
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
},
  ],

  // Global setup tears down test data before each full run
  globalSetup: './global-setup.ts',
});
