import { describe, expect, it, vi } from 'vitest';
import { SKIP_BUTTON, SKIP_OFFER_MS, playKeySkips, skipLabel, skipOffer, skipSegment } from '../../src/tv-solid/remote/player/skip-intro';
import type { PlaybackSegment } from '../../src/tv-solid/remote/types';

const intro: PlaybackSegment = { kind: 'intro', start_ms: 1000, end_ms: 2000 };
const recap: PlaybackSegment = { kind: 'recap', start_ms: 0, end_ms: 6000 };

describe('the skip affordance', () => {
  it('offers itself for six seconds and then withdraws into the controls', () => {
    expect(skipOffer(intro, true, true, 0)).toBe('button');
    expect(skipOffer(intro, true, true, SKIP_OFFER_MS - 1)).toBe('button');
    expect(skipOffer(intro, true, true, SKIP_OFFER_MS)).toBe('controls');
    expect(skipOffer(intro, true, true, 60000)).toBe('controls');
  });

  it('disappears with the segment, the profile setting or the seek capability', () => {
    expect(skipOffer(undefined, true, true, 0)).toBe('none');
    expect(skipOffer(intro, false, true, 0)).toBe('none');
    expect(skipOffer(intro, true, false, 0)).toBe('none');
  });

  it('names the segment it skips', () => {
    expect(skipLabel(intro)).toBe('Skip intro');
    expect(skipLabel(recap)).toBe('Skip recap');
    expect(skipLabel(undefined)).toBe('Skip intro');
  });

  it('lets the remote play key skip without taking the pause key with it', () => {
    expect(playKeySkips(intro, true, true)).toBe(true);
    expect(playKeySkips(undefined, true, true)).toBe(false);
    expect(playKeySkips(intro, false, true)).toBe(false);
    expect(playKeySkips(intro, true, false)).toBe(false);
  });

  it('keeps one button at the row right edge for every state', () => {
    // 1824 is the layout's right edge; the control row sits on the same line.
    expect(SKIP_BUTTON.x + SKIP_BUTTON.width).toBe(1824);
    expect(SKIP_BUTTON.y).toBe(846);
  });

  it('seeks past the segment and always gives the chrome back', async () => {
    const actions = { seek: vi.fn(async () => {}), clearSegments: vi.fn(), refreshSegments: vi.fn(async () => {}),
      seeking: vi.fn(), showControls: vi.fn(), hideControls: vi.fn() };
    await skipSegment(intro, actions);
    expect(actions.seek).toHaveBeenCalledWith(2);
    expect(actions.clearSegments).toHaveBeenCalledOnce();
    expect(actions.refreshSegments).toHaveBeenCalledOnce();
    expect(actions.seeking.mock.calls).toEqual([[true], [false]]);
    expect(actions.showControls).toHaveBeenCalledWith(true);
    expect(actions.hideControls).toHaveBeenCalledOnce();
  });

  it('still hides the chrome when the seek fails', async () => {
    const actions = { seek: vi.fn(async () => { throw new Error('lease gone'); }), clearSegments: vi.fn(),
      refreshSegments: vi.fn(async () => {}), seeking: vi.fn(), showControls: vi.fn(), hideControls: vi.fn() };
    await expect(skipSegment(intro, actions)).rejects.toThrow('lease gone');
    expect(actions.seeking).toHaveBeenLastCalledWith(false);
    expect(actions.hideControls).toHaveBeenCalledOnce();
    expect(actions.refreshSegments).not.toHaveBeenCalled();
  });
});
