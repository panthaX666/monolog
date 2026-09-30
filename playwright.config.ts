import { defineConfig, devices } from '@playwright/test';

// End-to-end tests of the core logging flow on a phone-sized screen (SPEC F1).
// Locally this uses the installed Edge; CI installs Playwright's Chromium.
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    ...devices['Pixel 7'],
    baseURL: 'http://localhost:4180/monolog/',
    serviceWorkers: 'block',
    channel: process.env.CI ? undefined : 'msedge',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx vite preview --port 4180 --strictPort',
    url: 'http://localhost:4180/monolog/',
    reuseExistingServer: !process.env.CI,
  },
});
