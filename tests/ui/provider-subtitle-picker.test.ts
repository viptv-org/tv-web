import { describe, expect, it, vi } from 'vitest';
import { createTrackPicker } from '../../src/tv-solid/remote/player/tracks';
function fixture(roku = false) {
  let modal: any;
  const player = { tracks: { audio: [], text: [], subtitlesSupported: false }, leaseId: 'lease', providerSubtitleSupport: true,
    providerSubtitles: vi.fn(async () => [{ id: 'scoped', label: 'English', language: 'en' }]), selectProviderSubtitle: vi.fn(async () => {}), providerSubtitleSelected: undefined,
    providerSubtitleDelay: 0, providerSubtitleTiming: 'Automatic timing unavailable', adjustProviderSubtitle: vi.fn(async () => {}), resetProviderSubtitle: vi.fn(async () => {}), selectTrack: vi.fn(async () => {}) };
  const column=vi.fn();
  const close = vi.fn(() => { modal = undefined; });
  const open = createTrackPicker({ player: player as any, roku, selection: { column, row: vi.fn() }, dialogs: { current: () => modal, open: value => { modal = value; }, close },
    subtitle: { enabled: () => false, current: () => undefined, adopt: vi.fn(), request: vi.fn() as any, path: () => '', override: vi.fn() } });
  return { open, player, close, column, modal: () => modal };
}
describe('provider subtitle picker', () => {
  it('makes provider selection reachable with no embedded subtitle tracks', async () => {
    const f = fixture(); f.open();
    const find = f.modal().columns[0].items.find((item: any) => item.id === 'provider-subtitles');
    expect(find).toBeDefined(); f.column.mockClear(); await find.run();
    expect(f.column).toHaveBeenCalledWith(0);
    const select = f.modal().columns[0].items.find((item: any) => item.id === 'scoped');
    expect(select).toBeDefined(); await select.run();
    expect(f.player.selectProviderSubtitle).toHaveBeenCalledWith({ id: 'scoped', label: 'English', language: 'en' });
  });
  it('keeps timing actions in an existing single-column drawer', async () => {
    const f=fixture(); (f.player as any).providerSubtitleSelected='scoped'; f.open();
    expect(f.modal().columns).toHaveLength(1);
    const timing=f.modal().columns[0].items.find((item:any)=>item.id==='provider-timing');
    expect(timing).toBeDefined(); await timing.run();
    expect(f.modal().columns).toHaveLength(1);
    expect(f.modal().columns[0].title).toBe('Automatic timing unavailable');
    await f.modal().columns[0].items[0].run();
    expect(f.player.adjustProviderSubtitle).toHaveBeenCalledWith(-0.5);
  });
  it('does not reopen discovery after Back or expose browser controls on Roku', async () => {
    const f = fixture(); let resolve!: (value: any[]) => void;
    f.player.providerSubtitles.mockImplementation(() => new Promise(done => { resolve = done; }));
    f.open(); const pending = f.modal().columns[0].items[0].run(); f.close();
    resolve([{ id: 'stale', label: 'Old', language: 'en' }]); await pending;
    expect(f.modal()).toBeUndefined();
    const roku = fixture(true); roku.open(); expect(roku.modal().columns).toEqual([]);
  });
});
