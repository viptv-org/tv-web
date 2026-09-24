import '@testing-library/jest-dom/vitest';

// Node 22+ exposes its own experimental globalThis.localStorage/sessionStorage
// (undefined without --localstorage-file). Vitest keeps those Node globals, so
// they shadow jsdom's Web Storage; point them back at the jsdom window's.
const jsdomWindow = (globalThis as { jsdom?: { window?: Window } }).jsdom?.window;
for (const name of ['localStorage', 'sessionStorage'] as const) {
  const storage = jsdomWindow?.[name];
  if (storage && (globalThis as Record<string, unknown>)[name] !== storage) {
    Object.defineProperty(globalThis, name, { configurable: true, enumerable: true, writable: true, value: storage });
  }
}
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
afterEach(cleanup);

import { beforeAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { initializeCore } from '../src/core';
beforeAll(async () => {
  await initializeCore(await readFile('vendor/core/wasm/viptv_core_bg.wasm'));
});
