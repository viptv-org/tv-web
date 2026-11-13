import { defineConfig } from '@playwright/test';
import base from './playwright.remote.config';

export default defineConfig({
  ...base,
  testMatch: ['startup-auth-recovery.spec.ts', 'source-memory-null.spec.ts'],
  use: { ...base.use, baseURL: 'https://127.0.0.1:18562', ignoreHTTPSErrors: true },
});
