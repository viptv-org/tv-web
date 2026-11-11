import { beforeEach, expect, it, vi } from 'vitest';
const fake = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('../src/roku/worker-task', () => ({
  postRokuTask: fake.post,
  RokuTaskResponseError: class extends Error {},
}));
import { RokuTaskResponseError } from '../src/roku/worker-task';
beforeEach(() => { vi.resetModules(); fake.post.mockReset(); });

it('sends scoped native operations, including every repeated clear', async () => {
  const { deviceStorage } = await import('../src/roku/device-storage');
  const values = new Map<string, string>();
  fake.post.mockImplementation(request => ({ result: Promise.resolve().then(() => {
    const key = request.section + '/' + request.key;
    if (request.action === 'load') return values.get(key) ?? null;
    if (request.action === 'save') values.set(key, request.value);
    else values.delete(key);
    return null;
  }) }));
  const session = deviceStorage('viptv-session', 'tokens');
  const settings = deviceStorage('viptv-playback', 'settings-v1');
  await session.save('opaque-session'); await settings.save('opaque-settings');
  expect(await deviceStorage('viptv-session', 'tokens').load()).toBe('opaque-session');
  await session.clear(); await session.clear();
  expect(await session.load()).toBeNull();
  expect(await settings.load()).toBe('opaque-settings');
  expect(fake.post.mock.calls.filter(([request]) => request.action === 'clear')).toHaveLength(2);
  expect(fake.post).toHaveBeenCalledWith({op:'storage',action:'save',section:'viptv-session',key:'tokens',value:'opaque-session'}, {timeoutMs:5000});
});

it('waits for a write acknowledgement before starting a later clear or read', async () => {
  const { deviceStorage } = await import('../src/roku/device-storage');
  let complete!: (value: null) => void;
  fake.post.mockReturnValueOnce({result:new Promise(resolve => { complete = resolve; })})
    .mockReturnValue({result:Promise.resolve(null)});
  const port = deviceStorage('viptv-session', 'tokens');
  const save = port.save('opaque'); const clear = port.clear(); const read = port.load();
  await Promise.resolve(); expect(fake.post).toHaveBeenCalledTimes(1);
  complete(null); await Promise.all([save, clear, read]);
  expect(fake.post.mock.calls.map(([request]) => request.action)).toEqual(['save','clear','load']);
});

it('permits a clear retry after an acknowledged native flush failure', async () => {
  const { deviceStorage } = await import('../src/roku/device-storage');
  fake.post.mockReturnValueOnce({result:Promise.reject(new RokuTaskResponseError('Device settings could not be saved.'))})
    .mockReturnValue({result:Promise.resolve(null)});
  const port = deviceStorage('viptv-session', 'tokens');
  await expect(port.save('opaque')).rejects.toThrow('could not be saved');
  await port.clear();
  expect(fake.post.mock.calls.map(([request]) => request.action)).toEqual(['save','clear']);
});

it('quarantines an uncertain timeout so a late save cannot race a later clear', async () => {
  const { deviceStorage } = await import('../src/roku/device-storage');
  let timeout!: (error: Error) => void;
  let finishNative!: () => void;
  let nativeValue: string | null = null;
  const lateNative = new Promise<void>(resolve => { finishNative = () => { nativeValue = 'late-save'; resolve(); }; });
  fake.post.mockReturnValue({result:new Promise((_, reject) => { timeout = reject; })});
  const port = deviceStorage('viptv-session', 'tokens');
  const save = expect(port.save('late-save')).rejects.toThrow('timed out');
  const clear = expect(port.clear()).rejects.toThrow('did not finish');
  await Promise.resolve(); timeout(new Error('WorkerTask timed out after 5000ms'));
  await Promise.all([save, clear]);
  finishNative(); await lateNative;
  expect(nativeValue).toBe('late-save');
  await expect(deviceStorage('viptv-playback', 'settings-v1').save('other')).rejects.toThrow('did not finish');
  expect(fake.post).toHaveBeenCalledTimes(1);
});
