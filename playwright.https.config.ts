import { defineConfig, devices } from '@playwright/test';

/** Trusted local HTTPS acceptance for the hosted TV entry; API/art boundaries are fixtures. */
export default defineConfig({
  testDir: './tests/e2e', testMatch: ['desktop-current-fixes.spec.ts', 'local-retirement.spec.ts', 'vizio-navigation.spec.ts', 'v2-discovery.spec.ts', 'browser-navigation.spec.ts', 'next-episode.spec.ts', 'player-remote.spec.ts', 'queue-progress.spec.ts', 'responsive-corrections.spec.ts'],
  outputDir: 'test-results/vizio-https', timeout: 45_000, workers: 1,
  use: { baseURL: process.env.VIPTV_TEST_BROWSER_ORIGIN ?? 'https://viptv.local.test:8443', trace: 'retain-on-failure' },
  projects: [{ name: 'vizio', use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } } }],
});
