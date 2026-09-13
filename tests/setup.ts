import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
afterEach(cleanup);

import { beforeAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { initializeCore } from '../src/core';
beforeAll(async () => {
  await initializeCore(await readFile('vendor/core/wasm/viptv_core_bg.wasm'));
});
