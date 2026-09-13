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
