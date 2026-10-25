import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/remote",
  workers: 1,
  fullyParallel: false,
  timeout: 30000,
  outputDir: "/tmp/viptv-tv-remote-tests",
  use: {
    baseURL:
      process.env.REMOTE_PREVIEW_ORIGIN ?? "https://viptv.local.test:18562",
    viewport: { width: 1920, height: 1080 },
    reducedMotion: "reduce",
    launchOptions: { args: ["--enable-unsafe-swiftshader"] },
    screenshot: "only-on-failure",
  },
});
