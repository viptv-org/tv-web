import { defineConfig } from "@playwright/test";
import base from "./playwright.remote.config";

export default defineConfig({...base, testMatch: ["hero-variant.spec.ts", "accent-confirmation.spec.ts"],
  use: {...base.use, baseURL: "https://127.0.0.1:18562", ignoreHTTPSErrors: true}});
