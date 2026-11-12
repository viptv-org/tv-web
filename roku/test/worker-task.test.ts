import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const host = vi.hoisted(() => ({
  props: {} as Record<string, any>,
  remove: vi.fn(),
  set: vi.fn(),
}));
vi.mock('@roku-sdk/solid', () => ({
  createElement: () => ({}),
  insertNode: vi.fn(),
  setProp: (_node: unknown, key: string, value: unknown) => {
    host.props[key] = value;
    host.set(key, value);
  },
  tmTransaction: { removeNode: host.remove },
}));
import { postRokuTask, RokuTaskResponseError } from '../src/roku/worker-task';
beforeEach(() => {
  vi.useFakeTimers();
  host.props = {};
  host.remove.mockClear();
  host.set.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('distinguishes a completed worker failure from an unconfirmed timeout', async () => {
  const request = {
    op: 'storage',
    action: 'load',
    section: 'viptv-session',
    key: 'tokens',
  } as const;
  const completed = postRokuTask(request, { parent: {}, timeoutMs: 5000 });
  const failure = expect(completed.result).rejects.toBeInstanceOf(RokuTaskResponseError);
  host.props.onResponse({ ok: false, error: 'Device settings could not be saved.' });
  await failure;
  const delayed = postRokuTask(request, { parent: {}, timeoutMs: 5000 });
  const timedOut = delayed.result.catch((error) => error);
  await vi.advanceTimersByTimeAsync(5000);
  expect(await timedOut).not.toBeInstanceOf(RokuTaskResponseError);
  expect(host.set).toHaveBeenCalledWith('control', 'STOP');
  // A late response cannot turn the already timed-out operation into an acknowledgement.
  host.props.onResponse({ ok: true, result: null });
  expect((await timedOut).message).toContain('timed out');
});

it('marks cancellation as unconfirmed while keeping successful responses intact', async () => {
  const cancelled = postRokuTask({ op: 'echo', value: 'opaque' }, { parent: {} });
  const error = cancelled.result.catch((value) => value);
  cancelled.cancel();
  expect(await error).not.toBeInstanceOf(RokuTaskResponseError);
  const complete = postRokuTask<string>({ op: 'echo', value: 'opaque' }, { parent: {} });
  host.props.onResponse({ ok: true, result: 'opaque' });
  await expect(complete.result).resolves.toBe('opaque');
});

it.each([undefined, {}, { ok: 'false' }])(
  'quarantines a malformed worker reply before a queued clear (%j)',
  async (response) => {
    vi.resetModules();
    vi.stubGlobal('__solidtvNativeRoot', {});
    const { jsonDeviceStorage } = await import('../src/roku/device-storage');
    const port = jsonDeviceStorage('viptv-session', 'tokens');
    const save = expect(port.save({ value: 'opaque' })).rejects.toThrow('WorkerTask failed');
    const clear = expect(port.clear()).rejects.toThrow('did not finish');
    await Promise.resolve();
    host.props.onResponse(response);
    await Promise.all([save, clear]);
    expect(
      host.set.mock.calls.filter(([key, value]) => key === 'control' && value === 'RUN'),
    ).toHaveLength(1);
  },
);

it.each(['response-first', 'terminal-first'] as const)(
  'waits for both reply and observed natural completion (%s)',
  async (order) => {
    const request = {
      op: 'storage',
      action: 'load',
      section: 'viptv-session',
      key: 'tokens',
    } as const;
    const task = postRokuTask<string>(request, { parent: {}, waitForCompletion: true });
    let resolved = false;
    void task.result.then(() => {
      resolved = true;
    });
    host.props.onState('stop');
    host.props.onState('run');
    if (order === 'response-first') {
      host.props.onResponse({ ok: true, result: 'opaque' });
      await Promise.resolve();
      expect(resolved).toBe(false);
      host.props.onState('stop');
    } else {
      host.props.onState('stop');
      await Promise.resolve();
      expect(resolved).toBe(false);
      host.props.onResponse({ ok: true, result: 'opaque' });
    }
    await expect(task.result).resolves.toBe('opaque');
    expect(
      host.set.mock.calls.filter(([key, value]) => key === 'control' && value === 'STOP'),
    ).toHaveLength(0);
    expect(host.remove).toHaveBeenCalledOnce();
  },
);

it('ignores initial STOP and handles synchronous RUN/reply/STOP without a leftover timer', async () => {
  host.set.mockImplementation((key: string, value: unknown) => {
    if (key === 'control' && value === 'RUN') {
      host.props.onState('stop');
      host.props.onState('run');
      host.props.onResponse({ ok: true, result: null });
      host.props.onState('stop');
    }
  });
  const task = postRokuTask(
    { op: 'storage', action: 'load', section: 'viptv-session', key: 'tokens' },
    { parent: {}, waitForCompletion: true },
  );
  await expect(task.result).resolves.toBeNull();
  expect(vi.getTimerCount()).toBe(0);
  expect(
    host.set.mock.calls.filter(([key, value]) => key === 'control' && value === 'STOP'),
  ).toHaveLength(0);
  host.set.mockReset();
});

it('keeps HTTP completion immediate even when the storage-only option is present', async () => {
  const task = postRokuTask(
    { op: 'http', url: 'https://fixture.example', method: 'GET' },
    { parent: {}, waitForCompletion: true },
  );
  host.props.onResponse({ ok: true, result: { status: 200 } });
  await expect(task.result).resolves.toEqual({ status: 200 });
  expect(host.set).toHaveBeenCalledWith('control', 'STOP');
});

it('does not classify native failure as completed until natural terminal is observed', async () => {
  const task = postRokuTask(
    { op: 'storage', action: 'load', section: 'viptv-session', key: 'tokens' },
    { parent: {}, waitForCompletion: true },
  );
  let settled = false;
  const error = task.result.catch((value) => {
    settled = true;
    return value;
  });
  host.props.onState('run');
  host.props.onResponse({ ok: false, error: 'Native flush failed' });
  await Promise.resolve();
  expect(settled).toBe(false);
  host.props.onState('stop');
  expect(await error).toBeInstanceOf(RokuTaskResponseError);
});
