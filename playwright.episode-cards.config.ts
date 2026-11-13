import { defineConfig } from "@playwright/test";
import base from "./playwright.remote.config";

export default defineConfig({
  ...base,
  testMatch: "episode-cards.spec.ts",
  timeout: 60000,
  use: {...base.use, baseURL: "https://127.0.0.1:18562", ignoreHTTPSErrors: true},
});
