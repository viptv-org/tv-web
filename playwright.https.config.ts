import { defineConfig, devices } from '@playwright/test';

/** Trusted local HTTPS acceptance for the hosted TV entry; API/art boundaries are fixtures. */
export default defineConfig({
  testDir: './tests/e2e', testMatch: 'vizio-navigation.spec.ts',
  outputDir: 'test-results/vizio-https', timeout: 45_000, workers: 1,
  use: { baseURL: 'https://viptv.local.test:8443', trace: 'retain-on-failure' },
  projects: [{ name: 'vizio', use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } } }],
});
