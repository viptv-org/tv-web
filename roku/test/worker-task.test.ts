import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const host = vi.hoisted(() => ({ props: {} as Record<string, any>, remove: vi.fn(), set: vi.fn() }));
vi.mock('@roku-sdk/solid', () => ({
  createElement: () => ({}), insertNode: vi.fn(),
  setProp: (_node: unknown, key: string, value: unknown) => { host.props[key] = value; host.set(key, value); },
  tmTransaction: { removeNode: host.remove },
}));
import { postRokuTask, RokuTaskResponseError } from '../src/roku/worker-task';
beforeEach(() => { vi.useFakeTimers(); host.props = {}; host.remove.mockClear(); host.set.mockClear(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('distinguishes a completed worker failure from an unconfirmed timeout', async () => {
  const request = {op:'storage',action:'clear',section:'viptv-session',key:'tokens'} as const;
  const completed = postRokuTask(request, {parent:{},timeoutMs:5000});
  const failure = expect(completed.result).rejects.toBeInstanceOf(RokuTaskResponseError);
  host.props.onResponse({ok:false,error:'Device settings could not be saved.'});
  await failure;
  const delayed = postRokuTask(request, {parent:{},timeoutMs:5000});
  const timedOut = delayed.result.catch(error => error);
  await vi.advanceTimersByTimeAsync(5000);
  expect(await timedOut).not.toBeInstanceOf(RokuTaskResponseError);
  expect(host.set).toHaveBeenCalledWith('control','STOP');
  // A late response cannot turn the already timed-out operation into an acknowledgement.
  host.props.onResponse({ok:true,result:null});
  expect((await timedOut).message).toContain('timed out');
});

it('marks cancellation as unconfirmed while keeping successful responses intact', async () => {
  const cancelled = postRokuTask({op:'echo',value:'opaque'}, {parent:{}});
  const error = cancelled.result.catch(value => value);
  cancelled.cancel(); expect(await error).not.toBeInstanceOf(RokuTaskResponseError);
  const complete = postRokuTask<string>({op:'echo',value:'opaque'}, {parent:{}});
  host.props.onResponse({ok:true,result:'opaque'});
  await expect(complete.result).resolves.toBe('opaque');
});

it.each([undefined, {}, {ok:'false'}])('quarantines a malformed worker reply before a queued clear (%j)', async response => {
  vi.resetModules();
  vi.stubGlobal('__solidtvNativeRoot', {});
  const { deviceStorage } = await import('../src/roku/device-storage');
  const port = deviceStorage('viptv-session', 'tokens');
  const save = expect(port.save('opaque')).rejects.toThrow('WorkerTask failed');
  const clear = expect(port.clear()).rejects.toThrow('did not finish');
  await Promise.resolve();
  host.props.onResponse(response);
  await Promise.all([save, clear]);
  expect(host.set.mock.calls.filter(([key, value]) => key === 'control' && value === 'RUN')).toHaveLength(1);
});
