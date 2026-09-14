import { describe, expect, it, vi } from 'vitest';
import { PlayerFullscreen } from '../../src/ui/usePlayerFullscreen';

describe('native fullscreen ownership', () => {
  it('toggles the host and restores fullscreen entered by the player', async () => {
    let active = false;
    const host = { isFullscreen: vi.fn(async () => active), setFullscreen: vi.fn(async (value: boolean) => { active = value; }) };
    const player = new PlayerFullscreen(host);
    expect(await player.toggle()).toBe(true);
    await player.release();
    expect(host.setFullscreen.mock.calls).toEqual([[true], [false]]);
  });
  it('does not exit an already fullscreen desktop when leaving playback', async () => {
    const host = { isFullscreen: vi.fn(async () => true), setFullscreen: vi.fn(async () => {}) };
    await new PlayerFullscreen(host).release();
    expect(host.setFullscreen).not.toHaveBeenCalled();
  });
  it('keeps ownership clear after the user explicitly exits fullscreen', async () => {
    let active = false;
    const host = { isFullscreen: async () => active, setFullscreen: vi.fn(async (value: boolean) => { active = value; }) };
    const player = new PlayerFullscreen(host);
    await player.toggle();
    await player.toggle();
    await player.release();
    expect(host.setFullscreen.mock.calls).toEqual([[true], [false]]);
  });
});
