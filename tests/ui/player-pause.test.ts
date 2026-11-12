import { describe, expect, it, vi } from 'vitest';
import { createPlayerActivation } from '../../src/tv-solid/remote/activation/player';
import { createPlayerTransport } from '../../src/tv-solid/remote/player-transport';
import { createPlayerMediaKeys } from '../../src/tv-solid/remote/input/player-media';

function fixture() {
  let visible = false;
  const pause = vi.fn(async () => undefined), play = vi.fn(async () => undefined);
  const setPlaying = vi.fn(async (playing: boolean) => { visible = true; await (playing ? play() : pause()); });
  const tracks = vi.fn(), seek = vi.fn(async () => undefined), next = vi.fn(async () => undefined);
  const options = {
    player: { player: { pause, play }, seek }, snapshot: () => ({ state: 'playing', time: { positionSeconds: 1 } }),
    actions: () => ({ pause: true, seek: true }), action: () => undefined, channel: () => undefined,
    choice: () => 0, buttons: () => [{ id: 'tracks' }],
    timeline: { value: () => undefined, set: vi.fn(), seeking: vi.fn() },
    chrome: { visible: () => visible, set: vi.fn((value: boolean) => { visible = value; }), hide: vi.fn() },
    segments: { active: () => undefined, clear: vi.fn(), refresh: vi.fn(async () => undefined) },
    skipEnabled: () => true, next, tracks, play: vi.fn(), details: vi.fn(), dialogs: { open: vi.fn() }, setPlaying,
  };
  return { options, pause, play, tracks, seek, next, setPlaying, visible: () => visible };
}

describe('pause chrome intent', () => {
  it('hidden Select pauses and reveals instead of invoking a stale tools selection', async () => {
    const f = fixture();
    await createPlayerActivation(f.options as unknown as Parameters<typeof createPlayerActivation>[0])();
    expect(f.pause).toHaveBeenCalledOnce(); expect(f.visible()).toBe(true);
    expect(f.tracks).not.toHaveBeenCalled(); expect(f.seek).not.toHaveBeenCalled();
  });
  it('a visible tools selection retains its action', async () => {
    const f = fixture(); f.options.chrome.set(true);
    await createPlayerActivation(f.options as unknown as Parameters<typeof createPlayerActivation>[0])();
    expect(f.tracks).toHaveBeenCalledOnce(); expect(f.pause).not.toHaveBeenCalled();
  });
  it('the independently visible skip chip retains explicit skip intent', async () => {
    const f = fixture();
    const options = {...f.options, segments: {...f.options.segments, active: () => ({kind:'intro', start_ms:0, end_ms:2000})}};
    await createPlayerActivation(options as unknown as Parameters<typeof createPlayerActivation>[0])();
    expect(f.seek).toHaveBeenCalledWith(2); expect(f.pause).not.toHaveBeenCalled();
  });
  for (const key of ['MediaPause', 'MediaPlayPause', ' ']) it(`${key} uses the shared revealed pause command`, async () => {
    const f = fixture();
    const options = {...f.options, active: () => undefined, seeking: {current:()=>false,set:vi.fn()},
      revealEnded:()=>false, chrome:{show:f.options.chrome.set,hide:vi.fn()}, fail:vi.fn()};
    createPlayerMediaKeys(options as unknown as Parameters<typeof createPlayerMediaKeys>[0])(new KeyboardEvent('keydown',{key}));
    expect(f.setPlaying).toHaveBeenCalledWith(false); expect(f.visible()).toBe(true);
  });
});

function deferred() {
  let resolve!: () => void, reject!: (error: Error) => void;
  const promise = new Promise<void>((yes,no)=>{resolve=yes;reject=no;});
  return {promise,resolve,reject};
}
describe('transport admission retirement', () => {
  it('a replacement retires delayed pause intent and its old completion cannot rearm new chrome', async () => {
    const command=deferred(), pending=vi.fn(), activity=vi.fn(), reveal=vi.fn();
    const transport=createPlayerTransport({pause:()=>command.promise,play:vi.fn(),pending,reveal,activity,active:()=>true});
    const old=transport.setPlaying(false); expect(pending).toHaveBeenLastCalledWith(true); expect(reveal).toHaveBeenCalledOnce();
    transport.retire(); expect(pending).toHaveBeenLastCalledWith(false);
    command.resolve(); await old; expect(activity).not.toHaveBeenCalled(); expect(pending).toHaveBeenCalledTimes(2);
  });
  it('a rejected old pause cannot report a failure into a replacement session', async () => {
    const command=deferred(), activity=vi.fn();
    const transport=createPlayerTransport({pause:()=>command.promise,play:vi.fn(),pending:vi.fn(),reveal:vi.fn(),activity,active:()=>true});
    const old=transport.setPlaying(false); transport.retire(); command.reject(new Error('old adapter'));
    await expect(old).resolves.toBeUndefined(); expect(activity).not.toHaveBeenCalled();
  });
  it('an older pause completion leaves a new pause intent owned by the replacement', async () => {
    const oldCommand=deferred(), newCommand=deferred(), pending=vi.fn(), activity=vi.fn();
    let command=oldCommand;
    const transport=createPlayerTransport({pause:()=>command.promise,play:vi.fn(),pending,reveal:vi.fn(),activity,active:()=>true});
    const old=transport.setPlaying(false); transport.retire(); command=newCommand;
    const current=transport.setPlaying(false); oldCommand.resolve(); await old;
    expect(pending).toHaveBeenLastCalledWith(true); expect(activity).not.toHaveBeenCalled();
    newCommand.resolve(); await current; expect(activity).toHaveBeenCalledOnce();
  });
  it('a rejection after leaving the player cannot fail the new screen without explicit retirement', async () => {
    const command=deferred(), pending=vi.fn(), activity=vi.fn(); let active=true;
    const transport=createPlayerTransport({pause:()=>command.promise,play:vi.fn(),pending,reveal:vi.fn(),activity,active:()=>active});
    const old=transport.setPlaying(false); active=false; command.reject(new Error('late pause'));
    await expect(old).resolves.toBeUndefined(); expect(activity).not.toHaveBeenCalled();
    expect(pending).toHaveBeenCalledTimes(1);
  });
  it('current command failure releases pending chrome ownership and remains visible to its caller', async () => {
    const pending=vi.fn(); const error=new Error('pause failed');
    const transport=createPlayerTransport({pause:async()=>{throw error;},play:vi.fn(),pending,reveal:vi.fn(),activity:vi.fn(),active:()=>true});
    await expect(transport.setPlaying(false)).rejects.toBe(error); expect(pending).toHaveBeenLastCalledWith(false);
  });
});
