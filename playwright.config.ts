import { defineConfig } from '@playwright/test';

const smokePort = Number(process.env.PLAYWRIGHT_PORT ?? 5323);
const smokeBaseURL = `http://127.0.0.1:${smokePort}`;

export default defineConfig({
  testDir: 'tests/smoke',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',

  use: {
    baseURL: smokeBaseURL,
    trace: process.env.CI ? 'on-first-retry' : 'off',
    screenshot: 'only-on-failure',
    viewport: { width: 1280, height: 720 },
  },

  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${smokePort} --strictPort`,
    url: smokeBaseURL,
    reuseExistingServer: false,
    timeout: 60_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
