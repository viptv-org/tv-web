import { act, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { MemoryDeviceSessionStore, TvApi } from '../../src/api';
import { App } from '../../src/ui/App';

it('bounds startup recovery when health succeeds but identity transport keeps failing', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  const store = new MemoryDeviceSessionStore();
  await store.save({ sessionId: 's', accountId: '1', profileId: '7', accessToken: 'fixture-access', refreshToken: 'fixture-refresh', expiresIn: 900 });
  let health = 0;
  let identities = 0;
  const api = new TvApi({ baseUrl: 'https://fixture.example', sessionStore: store, fetch: async input => {
    if (new URL(String(input)).pathname === '/api/health') {
      health++;
      // Bound the deliberately broken fixture even on the old hot loop.
      return new Response('{}', { status: health > 4 ? 503 : 200 });
    }
    identities++;
    throw new TypeError('Fixture identity transport unavailable');
  } });
  const rendered = render(<App api={api} layout="responsive" />);
  try {
    await act(async () => {});
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    await act(async () => {});
    expect(health).toBe(1);
    expect(identities).toBe(2);
    expect(screen.getByRole('alert')).toHaveTextContent('Can’t reach the backend');
    await act(async () => { await vi.advanceTimersByTimeAsync(9999); });
    expect(health).toBe(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(health).toBe(2);
  } finally {
    rendered.unmount();
    vi.useRealTimers();
  }
});

it('shows malformed HTTP200 identity once without treating it as backend downtime', async () => {
  vi.useFakeTimers();
  const store = new MemoryDeviceSessionStore();
  await store.save({ sessionId: 's', accountId: '1', profileId: '7', accessToken: 'fixture-access', refreshToken: 'fixture-refresh', expiresIn: 900 });
  let requests = 0;
  const api = new TvApi({ baseUrl: 'https://fixture.example', sessionStore: store, fetch: async () => {
    requests++;
    return new Response(JSON.stringify({ account: { id: 1, username: 'fixture', name: '', role: 'member' }, profiles: [{ id: 7, name: 'Profile', setup_complete: true }], profile_id: 7 }));
  } });
  const rendered = render(<App api={api} layout="responsive" />);
  try {
    await act(async () => {});
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid server response');
    expect(screen.queryByText('Can’t reach the backend')).not.toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
    expect(requests).toBe(1);
  } finally {
    rendered.unmount();
    vi.useRealTimers();
  }
});
