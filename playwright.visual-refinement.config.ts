import { defineConfig } from "@playwright/test";
import base from "./playwright.remote.config";

export default defineConfig({...base, timeout: 60000, testMatch: ["hero-variant.spec.ts", "accent-confirmation.spec.ts", "hero-carousel.spec.ts"],
  use: {...base.use, baseURL: "https://127.0.0.1:18562", ignoreHTTPSErrors: true}});
