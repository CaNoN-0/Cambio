import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// Use a pre-installed Chromium when one is provided (e.g. PW_CHROMIUM_PATH or /opt/pw-browsers/chromium);
// otherwise Playwright's own browser from `npx playwright install chromium`.
const executablePath = process.env.PW_CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const PORT = Number(process.env.E2E_PORT || 4173);

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    launchOptions: executablePath ? { executablePath } : undefined,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, grepInvert: /@mobile/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, grep: /@mobile/ },
  ],
  // The production server (server.js) serving the production build — the same artefact that deploys.
  webServer: {
    command: 'npm run build && node server.js',
    url: `http://localhost:${PORT}/api/health`,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    env: { PORT: String(PORT), NODE_ENV: 'production', IDENTITY_STORE: 'memory', ALLOW_NON_DURABLE_IDENTITY: 'true' },
  },
});
