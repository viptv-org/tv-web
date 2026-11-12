import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const fake = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('../src/roku/worker-task', () => ({
  postRokuTask: fake.post,
  RokuTaskResponseError: class extends Error {},
}));
import { RokuTaskResponseError } from '../src/roku/worker-task';
beforeEach(() => {
  vi.resetModules();
  fake.post.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
});
function memory(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const writes: string[] = [];
  fake.post.mockImplementation((request) => ({
    result: Promise.resolve().then(() => {
      const key = request.section + '/' + request.key;
      if (request.action === 'load') return values.get(key) ?? null;
      writes.push(request.value);
      values.set(key, request.value);
      return null;
    }),
  }));
  return { values, writes };
}
it('stores two distinct NEW JSON encodings and clears through the same path', async () => {
  const { jsonDeviceStorage } = await import('../src/roku/device-storage');
  const m = memory();
  const session = jsonDeviceStorage<{ accessToken: string; refreshToken: string }>(
    'viptv-session',
    'tokens',
  );
  const value = { accessToken: 'synthetic-access', refreshToken: 'synthetic-refresh' };
  await session.save(value);
  expect(m.writes).toHaveLength(2);
  expect(m.writes[0]).not.toBe(m.writes[1]);
  expect(m.writes.map((x) => JSON.parse(x))).toEqual([value, value]);
  expect(await session.load()).toEqual(value);
  await session.clear();
  await session.clear();
  expect(await session.load()).toBeNull();
  expect(m.values.get('viptv-session/tokens')).toBe('null');
  expect(m.writes.slice(2).map((x) => JSON.parse(x))).toEqual([null, null, null, null]);
  expect(fake.post.mock.calls.every(([, options]) => options.waitForCompletion === true)).toBe(
    true,
  );
});
it('keeps the whole read/two-write operation serialized across both sections', async () => {
  const { jsonDeviceStorage } = await import('../src/roku/device-storage');
  let complete!: (value: null) => void;
  fake.post
    .mockImplementationOnce(() => ({ result: Promise.resolve(null) }))
    .mockImplementationOnce(() => ({
      result: new Promise((resolve) => {
        complete = resolve;
      }),
    }))
    .mockImplementation(() => ({ result: Promise.resolve(null) }));
  const a = jsonDeviceStorage('viptv-session', 'tokens').save({ new: true });
  const b = jsonDeviceStorage('viptv-playback', 'settings-v1').save({ autoplay: false });
  await vi.waitFor(() => expect(fake.post).toHaveBeenCalledTimes(2));
  expect(fake.post.mock.calls.every(([request]) => request.section === 'viptv-session')).toBe(true);
  complete(null);
  await Promise.all([a, b]);
  expect(fake.post.mock.calls.map(([r]) => r.section + '/' + r.action)).toEqual([
    'viptv-session/load',
    'viptv-session/save',
    'viptv-session/save',
    'viptv-playback/load',
    'viptv-playback/save',
    'viptv-playback/save',
  ]);
});
it('selects a new first phase when retrying after an acknowledged partial failure', async () => {
  const { jsonDeviceStorage } = await import('../src/roku/device-storage');
  let raw = '{"old":true}',
    failFinal = true;
  const changed: boolean[] = [];
  const seen: string[] = [];
  fake.post.mockImplementation((request) => ({
    result: Promise.resolve().then(() => {
      if (request.action === 'load') return raw;
      seen.push(request.value);
      if (!request.value.startsWith(' ') && failFinal) {
        failFinal = false;
        throw new RokuTaskResponseError('Native flush failed');
      }
      changed.push(raw !== request.value);
      raw = request.value;
      return null;
    }),
  }));
  const store = jsonDeviceStorage('viptv-session', 'tokens'),
    value = { new: true };
  await expect(store.save(value)).rejects.toThrow('Native flush failed');
  expect(JSON.parse(raw)).toEqual(value);
  await store.save(value);
  expect(changed).toEqual([true, true, true]);
  expect(seen[0]).not.toBe(seen[2]);
  expect(await store.load()).toEqual(value);
});
it('retries interrupted clear without making its preparation a no-op', async () => {
  const { jsonDeviceStorage } = await import('../src/roku/device-storage');
  let raw = ' null',
    failFinal = true;
  const changed: boolean[] = [];
  fake.post.mockImplementation((request) => ({
    result: Promise.resolve().then(() => {
      if (request.action === 'load') return raw;
      if (request.value === 'null' && failFinal) {
        failFinal = false;
        throw new RokuTaskResponseError('Native flush failed');
      }
      changed.push(raw !== request.value);
      raw = request.value;
      return null;
    }),
  }));
  const store = jsonDeviceStorage('viptv-session', 'tokens');
  await expect(store.clear()).rejects.toThrow();
  expect(JSON.parse(raw)).toBeNull();
  await store.clear();
  await store.clear();
  expect(changed.every(Boolean)).toBe(true);
  expect(raw).toBe('null');
  expect(await store.load()).toBeNull();
});
it('quarantines a timed-out phase so late completion cannot race a queued clear', async () => {
  const { jsonDeviceStorage } = await import('../src/roku/device-storage');
  let rejectPhase!: (error: Error) => void, finishNative!: () => void;
  let raw = 'null';
  fake.post
    .mockReturnValueOnce({ result: Promise.resolve(raw) })
    .mockImplementationOnce((request) => {
      finishNative = () => {
        raw = request.value;
      };
      return {
        result: new Promise((_, reject) => {
          rejectPhase = reject;
        }),
      };
    });
  const store = jsonDeviceStorage('viptv-session', 'tokens');
  const save = expect(store.save({ new: true })).rejects.toThrow('timeout');
  const clear = expect(store.clear()).rejects.toThrow('did not finish');
  await vi.waitFor(() => expect(fake.post).toHaveBeenCalledTimes(2));
  rejectPhase(new Error('timeout'));
  await Promise.all([save, clear]);
  finishNative();
  expect(JSON.parse(raw)).toEqual({ new: true });
  await expect(
    jsonDeviceStorage('viptv-playback', 'settings-v1').save({ other: true }),
  ).rejects.toThrow('did not finish');
  expect(fake.post).toHaveBeenCalledTimes(2);
});
it('normalizes an interrupted JSON representation before the playback 16KiB check', async () => {
  const { jsonDeviceStorage, jsonStringPort } = await import('../src/roku/device-storage');
  const state = {
    version: 1,
    autoplay: false,
    across: Array.from({ length: 15 }, (_, i) => String(i).padEnd(1024, 'x')),
    entries: [],
  };
  state.across.push('x');
  state.across[15] = 'x'.repeat(1 + 16384 - JSON.stringify(state).length);
  const canonical = JSON.stringify(state);
  expect(Buffer.byteLength(canonical)).toBe(16384);
  expect(state.across[15].length).toBeLessThanOrEqual(1024);
  memory({ 'viptv-playback/settings-v1': '  ' + canonical });
  const port = jsonStringPort(jsonDeviceStorage<unknown>('viptv-playback', 'settings-v1'));
  expect(await port.load()).toBe(canonical);
  const { DevicePlayback } = await import('../../src/tv-solid/remote/device-playback');
  const playback = new DevicePlayback(port);
  await playback.ready;
  expect(playback.autoplay).toBe(false);
  expect(playback.across(state.across[15])).toBe(true);
  expect(fake.post.mock.calls.every(([r]) => r.action === 'load')).toBe(true);
});
it('reads legacy JSON records and rejects non-JSON string adapter writes', async () => {
  const { jsonDeviceStorage, jsonStringPort } = await import('../src/roku/device-storage');
  const value = { legacy: true };
  memory({ 'viptv-session/tokens': JSON.stringify(value) });
  const store = jsonDeviceStorage('viptv-session', 'tokens');
  expect(await store.load()).toEqual(value);
  const port = jsonStringPort(store);
  await expect(port.save('not json')).rejects.toThrow('could not be encoded');
  expect(fake.post).toHaveBeenCalledTimes(1);
});

it('isolates throwing observers and emits only static storage metadata', async () => {
  const { jsonDeviceStorage } = await import('../src/roku/device-storage');
  memory();
  const observer = vi.fn((event: Record<string, unknown>) => {
    void event;
    throw new Error('observer-failure');
  });
  vi.stubGlobal('__solidtvRuntimeObserver', observer);
  const store = jsonDeviceStorage('viptv-session', 'tokens');
  const value = { accessToken: 'SECRET', refreshToken: 'OTHER-SECRET' };
  await store.save(value);
  expect(await store.load()).toEqual(value);
  await store.clear();
  expect(await store.load()).toBeNull();
  expect(observer).toHaveBeenCalled();
  const events = observer.mock.calls.map(([event]) => event);
  expect(JSON.stringify(events)).not.toContain('SECRET');
  expect(
    events.every((event) =>
      Object.keys(event).every((key) =>
        ['operation', 'category', 'action', 'phase', 'status', 'step', 'at'].includes(key),
      ),
    ),
  ).toBe(true);
});
