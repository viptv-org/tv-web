import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/platform',
  workers: 1,
  fullyParallel: false,
  timeout: 30000,
  outputDir: '/tmp/viptv-packaged-tv-tests',
  use: {
    browserName: 'chromium',
    viewport: { width: 1920, height: 1080 },
    reducedMotion: 'reduce',
    launchOptions: { args: ['--allow-file-access-from-files', '--enable-unsafe-swiftshader'] },
    screenshot: 'only-on-failure',
  },
});
