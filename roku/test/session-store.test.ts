import { expect, it, vi } from 'vitest';
import { createRokuSessionStore } from '../src/roku/session-store';
import { RemoteTvApi } from '../../src/tv-solid/remote/api';
import type { Tokens } from '../../src/tv-solid/remote/types';

const original: Tokens = { accessToken: 'synthetic-access', refreshToken: 'synthetic-refresh' };
const bootstrap = { contract_version: 3, identity: { profile_id: '1' }, profile_management: { profiles: [] } };
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
function registry(initial: Tokens | null = original) {
  let raw = JSON.stringify(initial);
  const write = (value: Tokens) => { raw = JSON.stringify(value); };
  return {
    raw: () => raw,
    write,
    load: vi.fn(async (): Promise<Tokens | null> => JSON.parse(raw)),
    save: vi.fn(async (value: Tokens) => { write(value); }),
    clear: vi.fn(async () => { raw = 'null'; }),
  };
}

it('surfaces a reopen read failure instead of claiming saved credentials are absent; retry restores the same grant', async () => {
  const disk = registry();
  disk.load.mockRejectedValueOnce(new Error('Device settings could not be read.'));
  const fetcher = vi.fn(async (_url: RequestInfo | URL) => response(bootstrap));
  const api = new RemoteTvApi('https://fixture.example', createRokuSessionStore(disk), fetcher);
  await expect(api.restore()).rejects.toThrow('Device settings could not be read.');
  expect(fetcher).not.toHaveBeenCalled();
  expect(disk.clear).not.toHaveBeenCalled();
  expect(JSON.parse(disk.raw())).toEqual(original);
  await expect(api.restore()).resolves.toBe(true);
  await expect(api.bootstrap()).resolves.toMatchObject({ identity: { profile_id: '1' } });
  expect(fetcher.mock.calls.every(([url]) => !String(url).includes('/api/auth/device/'))).toBe(true);
  const reopened = new RemoteTvApi('https://fixture.example', createRokuSessionStore(disk), fetcher);
  await expect(reopened.restore()).resolves.toBe(true);
});

it('keeps a genuinely absent record distinct from read failure', async () => {
  const disk = registry(null);
  const api = new RemoteTvApi('https://fixture.example', createRokuSessionStore(disk));
  await expect(api.restore()).resolves.toBe(false);
  expect(disk.clear).not.toHaveBeenCalled();
});

it.each(['5xx', 'network'] as const)('retains durable credentials across reopen after transient refresh %s', async failure => {
  const disk = registry();
  const api = new RemoteTvApi('https://fixture.example', createRokuSessionStore(disk), async url => {
    if (String(url).endsWith('/refresh')) {
      if (failure === 'network') throw new TypeError('Network unavailable before response');
      return response({}, 503);
    }
    return response({}, 401);
  });
  await api.restore();
  await expect(api.bootstrap()).rejects.toThrow();
  expect(disk.clear).not.toHaveBeenCalled();
  expect(JSON.parse(disk.raw())).toEqual(original);
  const reopened = new RemoteTvApi('https://fixture.example', createRokuSessionStore(disk), async (url, init) => {
    if (String(url).endsWith('/refresh')) return response({ access_token: 'successor-access', refresh_token: 'successor-refresh' });
    return (init?.headers as Record<string, string>).Authorization === 'Bearer successor-access' ? response(bootstrap) : response({}, 401);
  });
  await expect(reopened.restore()).resolves.toBe(true);
  await expect(reopened.bootstrap()).resolves.toMatchObject({ identity: { profile_id: '1' } });
  expect(JSON.parse(disk.raw()).refreshToken).toBe('successor-refresh');
});

it('requires native save acknowledgement before finishing sign-in and survives a fresh API instance', async () => {
  const disk = registry(null);
  let commit!: () => void;
  disk.save.mockImplementation(value => new Promise<void>(resolve => {
    commit = () => { disk.write(value); resolve(); };
  }));
  const native = createRokuSessionStore(disk);
  const api = new RemoteTvApi('https://fixture.example', native, async () => response({ access_token: original.accessToken, refresh_token: original.refreshToken }));
  let finished = false;
  const paired = api.claim('synthetic-code', new AbortController().signal).then(() => { finished = true; });
  await vi.waitFor(() => expect(disk.save).toHaveBeenCalledOnce());
  expect(finished).toBe(false);
  expect(disk.raw()).toBe('null');
  commit();
  await paired;
  expect(finished).toBe(true);
  const reopened = new RemoteTvApi('https://fixture.example', createRokuSessionStore(disk));
  await expect(reopened.restore()).resolves.toBe(true);
});

it.each(['revoked', 'explicit logout'] as const)('honors %s rather than resurrecting saved authentication', async reason => {
  const disk = registry();
  const api = new RemoteTvApi('https://fixture.example', createRokuSessionStore(disk), async () => response({}, reason === 'revoked' ? 401 : 200));
  await api.restore();
  if (reason === 'revoked') await expect(api.bootstrap()).rejects.toMatchObject({ status: 401 });
  else await api.signOut();
  expect(disk.clear).toHaveBeenCalledOnce();
  const reopened = new RemoteTvApi('https://fixture.example', createRokuSessionStore(disk));
  await expect(reopened.restore()).resolves.toBe(false);
});
