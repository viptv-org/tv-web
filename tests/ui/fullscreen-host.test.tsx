import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlayerFullscreen } from '../../src/hooks/usePlayerFullscreen';
const bridge = vi.hoisted(() => ({ invoke: vi.fn(), isFullscreen: vi.fn(), setFullscreen: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: bridge.invoke }));
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => bridge }));
let fullscreen = false;
beforeEach(() => {
  fullscreen = false;
  Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} });
  bridge.isFullscreen.mockImplementation(async () => fullscreen);
  bridge.setFullscreen.mockImplementation(async (next: boolean) => { fullscreen = next; });
  bridge.invoke.mockImplementation(async () => { fullscreen = !fullscreen; return fullscreen; });
});
afterEach(() => { Reflect.deleteProperty(window, '__TAURI_INTERNALS__'); vi.resetAllMocks(); });
const root = { current: null };
const video = { current: null };
describe('player fullscreen host lifecycle', () => {
  it('owns the primary command entry and restores on leaving playback', async () => {
    const fail = vi.fn();
    const view = renderHook(({ active }) => usePlayerFullscreen(active, root, video, fail), { initialProps: { active: true } });
    await act(async () => { await view.result.current.toggle(); });
    expect(fail.mock.calls).toEqual([]);
    expect(bridge.invoke).toHaveBeenCalledWith('app_window_toggle_fullscreen');
    expect(view.result.current.fullscreen).toBe(true);
    await act(async () => { view.rerender({ active: false }); });
    expect(fullscreen).toBe(false);
    expect(bridge.setFullscreen).toHaveBeenCalledExactlyOnceWith(false);
    expect(fail).not.toHaveBeenCalled(); view.unmount();
  });
  it('preserves pre-existing window fullscreen and unowned non-player toggles', async () => {
    fullscreen = true;
    const view = renderHook(({ active }) => usePlayerFullscreen(active, root, video, vi.fn()), { initialProps: { active: true } });
    await act(async () => { view.rerender({ active: false }); });
    expect(fullscreen).toBe(true); expect(bridge.setFullscreen).not.toHaveBeenCalled();
    await act(async () => { await view.result.current.toggle(); await view.result.current.toggle(); });
    view.unmount(); await act(async () => {});
    expect(fullscreen).toBe(true);
  });
  it('uses the same ownership for fallback and explicit exit', async () => {
    bridge.invoke.mockRejectedValue(new Error('command unavailable'));
    const view = renderHook(() => usePlayerFullscreen(true, root, video, vi.fn()));
    await act(async () => { await view.result.current.toggle(); await view.result.current.exit(); });
    view.unmount(); await act(async () => {});
    expect(bridge.setFullscreen.mock.calls).toEqual([[true], [false]]);
  });
  it.each(['leave', 'unmount'])('releases a late command after %s', async change => {
    let resolve!: (next: boolean) => void;
    bridge.invoke.mockImplementation(() => new Promise<boolean>(done => { resolve = done; }));
    const view = renderHook(({ active }) => usePlayerFullscreen(active, root, video, vi.fn()), { initialProps: { active: true } });
    let toggling!: Promise<void>;
    await act(async () => { toggling = view.result.current.toggle(); });
    await act(async () => { if (change === 'leave') view.rerender({ active: false }); else view.unmount(); });
    await act(async () => { fullscreen = true; resolve(true); await toggling; });
    expect(fullscreen).toBe(false);
    expect(bridge.setFullscreen).toHaveBeenCalledExactlyOnceWith(false);
    if (change === 'leave') view.unmount();
  });
});
