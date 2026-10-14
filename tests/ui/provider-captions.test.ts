import { describe, expect, it, vi } from 'vitest';
import { ProviderCaptions } from '../../src/tv-solid/providerCaptions';
import { mergeProviderTracks } from '../../src/tv-solid/trackModel';
import type { MediaItem, TvApi } from '../../src/api';

const item = { id: 'opaque:episode', type: 'series' } as MediaItem;
const track = { id: 'opaque-subtitle', label: 'English · Addon', language: 'eng', provider_id: 'addon' };
const vtt = 'WEBVTT\n\n00:00:48.000 --> 00:00:50.000\nA &amp; B\n\n00:00:51.000 --> 00:00:53.000\nLater\n';

function fixture() {
  const api = { supportsProviderSubtitles: true, providerSubtitles: vi.fn(async () => [track]),
    providerSubtitleContent: vi.fn(async () => vtt) };
  const captions = new ProviderCaptions(api as unknown as TvApi); captions.reset(item);
  return { captions, api };
}
describe('provider captions on the original media clock', () => {
  it('discovers once and retains normalized cues through cuts without rebasing or refetching', async () => {
    const { captions, api } = fixture();
    await Promise.all([captions.discover(), captions.discover()]);
    const disable = vi.fn(async () => {}); await captions.select(track.id, disable);
    expect(api.providerSubtitles).toHaveBeenCalledTimes(1); expect(disable).toHaveBeenCalledTimes(1);
    expect(captions.at(48.6)).toEqual(['A & B']); expect(captions.at(0)).toEqual([]);
    expect(captions.at(51.5)).toEqual(['Later']); expect(captions.at(48.6)).toEqual(['A & B']);
    expect(api.providerSubtitleContent).toHaveBeenCalledTimes(1);
    captions.clear(); expect(captions.at(48.6)).toBeUndefined();
  });
  it('rejects late selection after a source reset and does not disable embedded captions', async () => {
    const { captions, api } = fixture(); await captions.discover();
    let finish!: (value: string) => void;
    api.providerSubtitleContent.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const disable = vi.fn(async () => {});
    const pending = expect(captions.select(track.id, disable)).rejects.toMatchObject({ name: 'AbortError' });
    captions.reset({ ...item, id: 'another-title' }); finish(vtt); await pending;
    expect(disable).not.toHaveBeenCalled(); expect(captions.selectedId).toBeNull();
  });
  it('retains the old selection when disabling an embedded track fails', async () => {
    const { captions, api } = fixture();
    api.providerSubtitles.mockResolvedValue([track, { ...track, id: 'other' }]);
    await captions.discover();
    await captions.select(track.id, async () => {});
    await expect(captions.select('other', async () => { throw new Error('decoder failed'); })).rejects.toThrow('decoder failed');
    expect(captions.at(48.6)).toEqual(['A & B']);
  });
  it('refreshes expiring unused selections while retaining an already loaded selection', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1000);
    try {
      const { captions, api } = fixture(); await captions.discover();
      await captions.select(track.id, async () => {});
      clock.mockReturnValue(1000 + 10 * 60_000);
      api.providerSubtitles.mockResolvedValue([{ ...track, id: 'new-selection' }]);
      const choices = await captions.discover();
      expect(choices.map(choice => choice.id)).toEqual(['new-selection', track.id]);
      await captions.select(track.id, async () => { throw new Error('should not reopen'); });
      expect(api.providerSubtitleContent).toHaveBeenCalledTimes(1);
      expect(captions.at(48.6)).toEqual(['A & B']);
    } finally { clock.mockRestore(); }
  });
  it('provides one Off choice and marks only the selected provider track current', () => {
    const choices = mergeProviderTracks([{ id: '__off__', label: 'Off', current: true, available: true, mode: 'off', inputIndex: -1 }],
      [{ id: track.id, label: track.label, current: true, available: true, mode: 'provider', inputIndex: -1 }]);
    expect(choices.filter(choice => choice.mode === 'off')).toHaveLength(1);
    expect(choices.filter(choice => choice.current).map(choice => choice.id)).toEqual([track.id]);
  });
});
