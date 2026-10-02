import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it } from 'vitest';
import { MemoryDeviceSessionStore, TvApi } from '../../src/api';
import { App } from '../../src/ui/App';

beforeEach(() => window.history.replaceState({}, '', '/tv/home'));

async function slowCatalogApi(saved = false) {
  const store = new MemoryDeviceSessionStore();
  await store.save({ sessionId: 's', accountId: '1', profileId: '7', accessToken: 'fixture-access', refreshToken: 'fixture-refresh', expiresIn: 900 });
  const paths: string[] = [];
  const catalogReplies: Array<() => void> = [];
  const api = new TvApi({ baseUrl: 'https://fixture.example', sessionStore: store, fetch: async (input, init) => {
    const path = new URL(String(input)).pathname;
    paths.push(path);
    if (path === '/api/discover') return new Promise<Response>((resolve, reject) => {
      catalogReplies.push(() => resolve(new Response(JSON.stringify({ metas: [{ id: 'ready', type: 'movie', name: 'Ready movie' }] }))));
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true });
    });
    const reply = path === '/api/auth/me'
      ? { account: { id: 1, username: 'fixture', name: 'Fixture', role: 'member' }, profiles: [{ id: 7, name: 'Profile', setup_complete: true }], profile_id: 7, restricted: false, profile_setup_required: false }
      : path === '/api/catalogs' ? [{ id: 'featured', type: 'movie', name: 'Featured', addon_id: '1', addon_name: 'Fixture' }]
      : path === '/api/catalogs/revision' ? { revision: 'fixture' }
      : path.endsWith('/continue/page') ? { items: [], offset: 0, total: 0, next_offset: null }
      : path === '/api/v2/iptv/live/channels' ? { catalog_id: 1, generation: 1, items: [], next_cursor: null, previous_cursor: null }
      : path.endsWith('/preferences') ? {}
      : path.endsWith('/favorites') && saved ? [{ id: 'saved', type: 'movie', name: 'Saved movie' }]
      : [];
    return new Response(JSON.stringify(reply));
  } });
  return { api, paths, settleCatalog: () => catalogReplies.at(-1)?.() };
}

it('keeps the Home skeleton while its first catalog is pending after saved rows arrive', async () => {
  const { api, paths } = await slowCatalogApi();
  const rendered = render(<App api={api} layout="responsive" />);
  try {
    await waitFor(() => expect(paths).toContain('/api/discover'));
    await act(async () => {});
    expect(rendered.container.querySelector('.vx-home-skel')).not.toBeNull();
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
  } finally { rendered.unmount(); }
});

it('keeps saved Home cards usable and permits leaving while the hero catalog is pending', async () => {
  const { api, paths } = await slowCatalogApi(true);
  const rendered = render(<App api={api} layout="responsive" />);
  try {
    await waitFor(() => expect(paths).toContain('/api/discover'));
    expect(screen.getByRole('button', { name: 'Saved movie' })).toBeEnabled();
    expect(rendered.container.querySelector('.vx-home-skel')).toBeNull();
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Discover' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Discover' })).toBeInTheDocument());
    await waitFor(() => expect(rendered.container.querySelector('.vx-browse__skeleton')).not.toBeNull());
  } finally { rendered.unmount(); }
});

it('restores a Discover URL before the optional Home hero catalog settles', async () => {
  const original = window.location.href;
  window.history.replaceState({}, '', '/tv/discover');
  const { api } = await slowCatalogApi();
  const rendered = render(<App api={api} layout="responsive" />);
  try {
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Discover' })).toBeInTheDocument());
    await waitFor(() => expect(rendered.container.querySelector('.vx-browse__skeleton')).not.toBeNull());
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
  } finally {
    rendered.unmount();
    window.history.replaceState({}, '', original);
  }
});

it('reloads cancelled optional Home data when browser Back returns to its pending snapshot', async () => {
  const { api, paths, settleCatalog } = await slowCatalogApi();
  const rendered = render(<App api={api} layout="responsive" />);
  try {
    await waitFor(() => expect(paths.filter(path => path === '/api/discover')).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: 'Discover' }));
    await waitFor(() => expect(paths.filter(path => path === '/api/discover')).toHaveLength(2));
    await act(async () => { window.history.back(); });
    await waitFor(() => expect(paths.filter(path => path === '/api/discover')).toHaveLength(3));
    await act(async () => { settleCatalog(); });
    await waitFor(() => expect(screen.getAllByText('Ready movie').length).toBeGreaterThan(0));
    expect(rendered.container.querySelector('.vx-home-skel')).toBeNull();
  } finally { rendered.unmount(); }
});
