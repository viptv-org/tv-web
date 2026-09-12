import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Guide as GuideData, GuideProgram, LiveCategories, LivePage, MediaItem, TvApi } from '../../src/api';
import { Guide, guideCells } from '../../src/ui/Guide';
import { RemoteRoot } from '../../src/ui/remote';

const start = 1_700_000_000;
const channels = Array.from({ length: 80 }, (_, index): MediaItem => ({
  id: `channel-${index}`,
  type: 'live',
  name: `Channel ${index + 1}`,
  title: `Channel ${index + 1}`,
  genres: [],
  raw: {},
}));

function page(offset: number): LivePage {
  return { channels: channels.slice(offset, offset + 40), total: channels.length };
}

function apiFixture() {
  return {
    createScope: vi.fn(() => {
      const controller = new AbortController();
      return { signal: controller.signal, abort: () => controller.abort() };
    }),
    live: vi.fn(async ({ offset = 0 }) => page(offset)),
    liveCategories: vi.fn(async (): Promise<LiveCategories> => ({
      total: 2,
      categories: [
        { id: 'section:news', name: 'News', count: 12, raw: {} },
        { id: 'section:sports', name: 'Sports', count: 8, raw: {} },
      ],
    })),
    guide: vi.fn(async (): Promise<GuideData> => ({ programs: [], timezone: 'UTC' })),
  };
}

describe('guide cells', () => {
  it('fills schedule gaps and caps a window at 32 cells', () => {
    const programs: GuideProgram[] = [
      { title: 'Programme', start: start + 1800, end: start + 3600, raw: {} },
    ];
    expect(guideCells(programs, start, start + 7200)).toEqual([
      expect.objectContaining({ title: 'No schedule available', missing: true, start, end: start + 1800 }),
      expect.objectContaining({ title: 'Programme', missing: false }),
      expect.objectContaining({ title: 'No schedule available', missing: true, start: start + 3600, end: start + 7200 }),
    ]);

    const dense = Array.from({ length: 40 }, (_, index): GuideProgram => ({
      title: String(index), start: start + index * 60, end: start + (index + 1) * 60, raw: {},
    }));
    expect(guideCells(dense, start, start + 7200)).toHaveLength(32);
  });
});

describe('Guide', () => {
  it('uses real category filters and keeps five guide rows visible', async () => {
    const api = apiFixture();
    render(<Guide api={api as unknown as TvApi} onPlay={vi.fn()} onError={vi.fn()} onDetails={vi.fn()} />);

    expect(await screen.findByRole('button', { name: 'News · 12' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByTestId(/guide-row-/)).toHaveLength(5));
    fireEvent.click(screen.getByRole('button', { name: 'News · 12' }));
    await waitFor(() => expect(api.live).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'section:news', offset: 0 }), expect.anything()));
  });

  it('loads the previous forty-channel page and restores focus to its final row', async () => {
    const api = apiFixture();
    render(<Guide api={api as unknown as TvApi} onPlay={vi.fn()} onError={vi.fn()} onDetails={vi.fn()} />);
    const next = await screen.findByRole('button', { name: 'Next channels' });
    fireEvent.click(next);
    await screen.findByRole('button', { name: 'Channel 41' });

    const first = screen.getByRole('button', { name: 'Channel 41' });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowUp' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Channel 40' })).toHaveFocus());
  });

  it('uses the remote text entry for a trimmed, bounded live search and handles Back locally', async () => {
    const api = apiFixture();
    const back = vi.fn();
    render(
      <RemoteRoot onBack={back}>
        <Guide api={api as unknown as TvApi} onPlay={vi.fn()} onError={vi.fn()} onDetails={vi.fn()} />
      </RemoteRoot>,
    );

    const search = await screen.findByRole('button', { name: 'Search Live TV' });
    fireEvent.click(search);
    expect(await screen.findByRole('heading', { name: 'Search Live TV' })).toBeInTheDocument();
    const entered = `  ${'n'.repeat(130)}  `;
    fireEvent.change(screen.getByRole('textbox', { name: 'Search Live TV' }), { target: { value: entered } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const expected = 'n'.repeat(128);
    await waitFor(() => expect(api.live).toHaveBeenLastCalledWith(expect.objectContaining({ search: expected, offset: 0 }), expect.anything()));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Search Live TV' })).not.toBeInTheDocument());

    const restoredSearch = screen.getByRole('button', { name: `Search Live TV: ${expected}` });
    fireEvent.click(restoredSearch);
    const key = await screen.findByRole('button', { name: /^A$/ });
    key.focus();
    fireEvent.keyDown(key, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Search Live TV' })).not.toBeInTheDocument());
    await waitFor(() => expect(restoredSearch).toHaveFocus());
    expect(back).not.toHaveBeenCalled();
  });
});
