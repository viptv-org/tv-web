import { act, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useNativeShutdown } from '../../src/ui/app/useNativeShutdown';

const bridge = vi.hoisted(() => ({ listen: vi.fn(), invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: bridge.listen }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: bridge.invoke }));
afterEach(() => {
  Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
  vi.resetAllMocks();
});
function Host({ controller }: { controller: { current?: { stop(): Promise<void> } } }) {
  useNativeShutdown(controller);
  return null;
}

it('coalesces close requests and acknowledges only after playback release settles', async () => {
  Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} });
  let requestClose: () => void = () => {};
  const off = vi.fn();
  bridge.listen.mockImplementation((_event: string, listener: () => void) => {
    requestClose = listener;
    return Promise.resolve(off);
  });
  bridge.invoke.mockResolvedValue(undefined);
  let released: () => void = () => {};
  const stop = vi.fn(() => new Promise<void>(resolve => { released = resolve; }));
  const rendered = render(<Host controller={{ current: { stop } }} />);
  try {
    await act(async () => { requestClose(); requestClose(); });
    expect(stop).toHaveBeenCalledTimes(1);
    expect(bridge.invoke).not.toHaveBeenCalled();
    await act(async () => { released(); });
    expect(bridge.invoke).toHaveBeenCalledExactlyOnceWith('app_shutdown_ready');
  } finally { rendered.unmount(); }
  await act(async () => {});
  expect(off).toHaveBeenCalledOnce();
});

it('retires a late listener and permits native cleanup when release fails', async () => {
  Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} });
  let requestClose: () => void = () => {};
  let registered: (off: () => void) => void = () => {};
  bridge.listen.mockImplementation((_event: string, listener: () => void) => {
    requestClose = listener;
    return new Promise<() => void>(resolve => { registered = resolve; });
  });
  bridge.invoke.mockResolvedValue(undefined);
  const stop = vi.fn().mockRejectedValue(new Error('Fixture release failure'));
  const rendered = render(<Host controller={{ current: { stop } }} />);
  await act(async () => { requestClose(); });
  expect(bridge.invoke).toHaveBeenCalledExactlyOnceWith('app_shutdown_ready');
  rendered.unmount();
  const off = vi.fn();
  await act(async () => { registered(off); requestClose(); });
  expect(off).toHaveBeenCalledOnce();
  expect(stop).toHaveBeenCalledOnce();
});
