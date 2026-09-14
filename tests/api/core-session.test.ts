import { expect, it } from 'vitest';
import { MemoryDeviceSessionStore, TvApi } from '../../src/api';

it('drives remembered-profile startup through Rust and shares rotated credentials with media HTTP', async () => {
  const store = new MemoryDeviceSessionStore();
  await store.save({ sessionId: 's', accountId: '1', profileId: '7', accessToken: 'old', refreshToken: 'refresh', expiresIn: 900 });
  const calls: { path: string; authorization: string | null }[] = [];
  const replies = [
    new Response('{}', { status: 401 }),
    new Response(JSON.stringify({ session_id: 's', account_id: 1, profile_id: 7, access_token: 'fresh', refresh_token: 'rotated', expires_in: 900 })),
    new Response(JSON.stringify({ account: { id: 1, username: 'owner', name: 'Owner', role: 'owner' }, profiles: [{ id: 7, name: 'Family', setup_complete: true }], profile_id: 7, restricted: false, profile_setup_required: false })),
    new Response('[]'),
  ];
  const api = new TvApi({ baseUrl: 'https://viptv.example', sessionStore: store, fetch: async (input, init) => {
    calls.push({ path: new URL(String(input)).pathname, authorization: new Headers(init?.headers).get('authorization') });
    const reply = replies.shift();
    if (!reply) throw new Error('Unexpected request');
    return reply;
  } });
  const phases: string[] = [];
  const driver = api.createSessionDriver(view => phases.push(view.phase), message => { throw new Error(message); });
  try {
    await driver.dispatch({ Begin: { origin: api.serverOrigin, allowInsecurePreview: false } });
    await driver.idle();
    expect(phases[phases.length - 1]).toBe('Ready');
    await api.catalogs();
    expect(calls.map(call => call.path)).toEqual(['/api/auth/me', '/api/auth/device/refresh', '/api/auth/me', '/api/catalogs']);
    expect(calls[calls.length - 1]?.authorization).toBe('Bearer fresh');
    expect((await store.load())?.refreshToken).toBe('rotated');
  } finally { driver.dispose(); }
});

it('settles explicit profile selection after the backend confirms the selected session scope', async () => {
  const store = new MemoryDeviceSessionStore();
  await store.save({ sessionId: 's', accountId: '1', profileId: null, accessToken: 'access', refreshToken: 'refresh', expiresIn: 900 });
  let selectedProfile: string | null = null;
  let selections = 0;
  const api = new TvApi({ baseUrl: 'https://viptv.example', sessionStore: store, fetch: async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (path === '/api/auth/profile') {
      selectedProfile = JSON.parse(await new Response(init?.body).text()).profile_id;
      selections++;
      return new Response('{}');
    }
    if (path === '/api/auth/me') return new Response(JSON.stringify({ account: { id: 1, username: 'owner', name: 'Owner', role: 'owner' }, profiles: [{ id: 7, name: 'Family', setup_complete: true }], profile_id: selectedProfile, restricted: false, profile_setup_required: false }));
    throw new Error('Unexpected request');
  } });
  const driver = api.createSessionDriver(() => {}, message => { throw new Error(message); });
  try {
    await driver.dispatch({ Begin: { origin: api.serverOrigin, allowInsecurePreview: false } });
    await driver.idle();
    await api.selectProfile('7');
    expect(selections).toBe(1);
    expect((await store.load())?.profileId).toBe('7');
  } finally { driver.dispose(); }
});

it('retains rotated credentials when the screen that triggered refresh is cancelled', async () => {
  const store = new MemoryDeviceSessionStore();
  await store.save({ sessionId: 's', accountId: '1', profileId: '7', accessToken: 'old', refreshToken: 'refresh', expiresIn: 900 });
  let expire = false;
  let rotationStarted!: () => void;
  const started = new Promise<void>(resolve => { rotationStarted = resolve; });
  let finishRotation!: () => void;
  const rotation = new Promise<void>(resolve => { finishRotation = resolve; });
  const api = new TvApi({ baseUrl: 'https://viptv.example', sessionStore: store, fetch: async (input, init) => {
    const path = new URL(String(input)).pathname;
    const old = new Headers(init?.headers).get('authorization') === 'Bearer old';
    if (path === '/api/auth/device/refresh') {
      rotationStarted();
      await rotation;
      init?.signal?.throwIfAborted();
      return new Response(JSON.stringify({ session_id: 's', account_id: 1, profile_id: 7, access_token: 'fresh', refresh_token: 'rotated', expires_in: 900 }));
    }
    if (expire && old) return new Response('{}', { status: 401 });
    if (path === '/api/auth/me') return new Response(JSON.stringify({ account: { id: 1, username: 'owner', name: 'Owner', role: 'owner' }, profiles: [{ id: 7, name: 'Family', setup_complete: true }], profile_id: 7, restricted: false, profile_setup_required: false }));
    if (path === '/api/catalogs') { init?.signal?.throwIfAborted(); return new Response('[]'); }
    throw new Error('Unexpected request');
  } });
  const driver = api.createSessionDriver(() => {}, () => {});
  try {
    await driver.dispatch({ Begin: { origin: api.serverOrigin, allowInsecurePreview: false } });
    await driver.idle();
    expire = true;
    const scope = api.createScope();
    const cancelled = api.catalogs(scope.request()).catch(error => error);
    await started;
    const active = api.catalogs();
    scope.abort();
    finishRotation();
    expect(await cancelled).toMatchObject({ name: 'AbortError' });
    await expect(active).resolves.toEqual([]);
    expect((await store.load())?.refreshToken).toBe('rotated');
  } finally { driver.dispose(); }
});

it.each([false, true])('serializes refresh across two tabs (expired at startup: %s)', async (expiredAtStartup) => {
  const store = new MemoryDeviceSessionStore();
  await store.save({ sessionId: 's', accountId: '1', profileId: '7', accessToken: 'old', refreshToken: 'refresh', expiresIn: 900 });
  let lockQueue = Promise.resolve();
  const sharedStore = {
    load: () => store.load(), save: (tokens: Awaited<ReturnType<typeof store.load>>) => store.save(tokens!), clear: () => store.clear(),
    withLock<T>(work: () => Promise<T>): Promise<T> {
      const task = lockQueue.then(work);
      lockQueue = task.then(() => {}, () => {});
      return task;
    },
  };
  let expired = expiredAtStartup;
  let rotations = 0;
  const fetcher: typeof fetch = async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (path === '/api/auth/device/refresh') {
      rotations++;
      if (rotations > 1) return new Response('{}', { status: 401 });
      return new Response(JSON.stringify({ session_id: 's', account_id: 1, profile_id: 7, access_token: 'fresh', refresh_token: 'rotated', expires_in: 900 }));
    }
    if (expired && new Headers(init?.headers).get('authorization') === 'Bearer old') return new Response('{}', { status: 401 });
    if (path === '/api/auth/me') return new Response(JSON.stringify({ account: { id: 1, username: 'owner', name: 'Owner', role: 'owner' }, profiles: [{ id: 7, name: 'Family', setup_complete: true }], profile_id: 7, restricted: false, profile_setup_required: false }));
    return new Response('[]');
  };
  const tabs = [0, 1].map(() => new TvApi({ baseUrl: 'https://viptv.example', sessionStore: sharedStore, fetch: fetcher }));
  const drivers = tabs.map(api => api.createSessionDriver(() => {}, () => {}));
  try {
    await Promise.all(drivers.map((driver, i) => driver.dispatch({ Begin: { origin: tabs[i].serverOrigin, allowInsecurePreview: false } })));
    await Promise.all(drivers.map(driver => driver.idle()));
    expired = true;
    const results = await Promise.allSettled(tabs.map(api => api.catalogs()));
    expect(results.map(result => result.status)).toEqual(['fulfilled', 'fulfilled']);
    expect(rotations).toBe(1);
    expect((await store.load())?.refreshToken).toBe('rotated');
  } finally { drivers.forEach(driver => driver.dispose()); }
});
