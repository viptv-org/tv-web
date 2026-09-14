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
  genres: [], episodes: [],
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
  it('loads the next channel page at the end of the loaded rows and restores the current timeline', async () => {
    const api = apiFixture();
    const onPlay = vi.fn();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(start * 1000);
    try {
      const { container } = render(<Guide responsive api={api as unknown as TvApi} onPlay={onPlay} onError={vi.fn()} onDetails={vi.fn()} />);
      await screen.findByRole('button', { name: 'Channel 1' });
      // The responsive guide has no paging controls: the category sidebar
      // narrows channels, and the end of the loaded rows loads the next page.
      expect(screen.queryByRole('button', { name: 'Previous channels' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Next channels' })).not.toBeInTheDocument();
      expect(screen.getAllByTestId(/guide-row-/)).toHaveLength(40);
      expect(screen.getByRole('button', { name: 'Channel 40' })).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('40 of 80 channels');
      const region = screen.getByRole('region', { name: 'Scrollable programme guide' });
      expect(region).toHaveAttribute('tabindex', '0');
      Object.defineProperty(region, 'scrollHeight', { value: 4000, configurable: true });
      Object.defineProperty(region, 'clientHeight', { value: 500, configurable: true });
      region.scrollTop = 3600;
      fireEvent.scroll(region);
      await screen.findByRole('button', { name: 'Channel 41' });
      expect(api.live).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 40 }), expect.anything());
      expect(screen.getAllByTestId(/guide-row-/)).toHaveLength(80);
      expect(screen.getByRole('status')).toHaveTextContent('80 of 80 channels');
      fireEvent.click(screen.getByRole('button', { name: 'Channel 42' }));
      expect(onPlay).toHaveBeenLastCalledWith(channels[41]);

      const timeline = container.querySelector('.guide-header')!;
      const initialLabels = timeline.textContent;
      const earlier = screen.getByRole('button', { name: 'Earlier' });
      expect(earlier).toBeDisabled();
      fireEvent.click(screen.getByRole('button', { name: 'Later' }));
      expect(timeline.textContent).not.toBe(initialLabels);
      expect(earlier).not.toBeDisabled();
      expect(container.querySelector('.responsive-guide-now')).not.toBeInTheDocument();
      fireEvent.click(earlier);
      expect(timeline.textContent).toBe(initialLabels);
      fireEvent.click(screen.getByRole('button', { name: 'Later' }));
      fireEvent.click(screen.getByRole('button', { name: 'Now' }));
      expect(timeline.textContent).toBe(initialLabels);
      expect(screen.getByRole('button', { name: 'Now' })).toHaveAttribute('aria-pressed', 'true');
      expect(container.querySelector('.responsive-guide-now')).toBeInTheDocument();
      expect(earlier).toBeDisabled();
    } finally {
      clock.mockRestore();
    }
  });

  it('shares desktop and compact category filters without remote navigation or arrival focus', async () => {
    const api = apiFixture();
    const onPlay = vi.fn();
    render(<Guide responsive api={api as unknown as TvApi} onPlay={onPlay} onError={vi.fn()} onDetails={vi.fn()} />);
    const first = await screen.findByRole('button', { name: 'Channel 1' });
    expect(first).not.toHaveFocus();
    fireEvent.keyDown(first, { key: 'MediaPlay' });
    expect(onPlay).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('combobox', { name: 'Channel category' }), { target: { value: 'category:section:news' } });
    await waitFor(() => expect(api.live).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'section:news', offset: 0 }), expect.anything()));
    expect(screen.getByRole('button', { name: 'News · 12' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'My channels' }));
    await waitFor(() => expect(api.live).toHaveBeenLastCalledWith(expect.objectContaining({ collection: 'favorites', category: undefined, offset: 0 }), expect.anything()));
    expect(screen.getByRole('combobox', { name: 'Channel category' })).toHaveValue('favorites');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search Live TV' }), { target: { value: '  news  ' } });
    await waitFor(() => expect(api.live).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'news', offset: 0 }), expect.anything()));
  });

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
    await screen.findByRole('button', { name: 'Channel 1' });
    // The Roku guide pages when Down crosses its final channel, without a
    // separate pager button. Exercise the complete remote path through rows.
    for (let number = 1; number <= 40; number += 1) {
      const channel = screen.getByRole('button', { name: `Channel ${number}` });
      channel.focus();
      fireEvent.keyDown(channel, { key: 'ArrowDown' });
      await waitFor(() => expect(screen.getByRole('button', { name: `Channel ${number + 1}` })).toHaveFocus());
    }
    expect(api.live).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 40 }), expect.anything());
    expect(screen.getByText('41 / 80')).toBeInTheDocument();

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
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    const expected = 'n'.repeat(128);
    await waitFor(() => expect(api.live).toHaveBeenLastCalledWith(expect.objectContaining({ search: expected, offset: 0 }), expect.anything()));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Search Live TV' })).not.toBeInTheDocument());

    const restoredSearch = screen.getByRole('button', { name: `Search Live TV: ${expected}` });
    fireEvent.click(restoredSearch);
    const key = await screen.findByRole('button', { name: /^a$/ });
    key.focus();
    fireEvent.keyDown(key, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Search Live TV' })).not.toBeInTheDocument());
    await waitFor(() => expect(restoredSearch).toHaveFocus());
    expect(back).not.toHaveBeenCalled();
  });
});
