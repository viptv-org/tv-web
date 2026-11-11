import { expect, test, vi } from 'vitest';

const host = vi.hoisted(() => ({
  ready: false,
  loaded: false,
  config: { preventDefaultOnHandledKeys: false },
  setRendererFactory: vi.fn(),
}));

vi.mock('@solidtv/solid', () => {
  if (!host.ready) throw new Error('Framework loaded before browser services');
  host.loaded = true;
  return { Config: host.config, setRendererFactory: host.setRendererFactory };
});

import { installSolidHost } from '../src/roku/solid-host';

test('framework evaluation waits for host services and installs the public factory', async () => {
  expect(host.loaded).toBe(false);
  host.ready = true;
  const factory = vi.fn();
  await installSolidHost(factory);
  expect(host.loaded).toBe(true);
  expect(host.config.preventDefaultOnHandledKeys).toBe(true);
  expect(host.setRendererFactory).toHaveBeenCalledExactlyOnceWith(factory);
});
