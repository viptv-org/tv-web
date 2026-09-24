import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Guide as GuideData, GuideProgram, LiveCategories, LivePage, MediaItem, TvApi } from '../../src/api';
import { Guide, guideCells } from '../../src/ui/Guide';
import { firstVisibleRow, timeRange } from '../../src/ui/guide-core';
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

function apiFixture(guide: (id: string) => GuideData = () => ({ programs: [], timezone: 'UTC' })) {
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
    guide: vi.fn(async (id: string) => guide(id)),
  };
}

/** A schedule around `start`: one programme on air and the one after it. */
const schedule = (): GuideData => ({
  timezone: 'UTC',
  programs: [
    { title: 'Squawk on the Street', description: 'Live business news.', start: start - 5_400, end: start + 3_600, raw: {} },
    { title: 'Halftime Report', start: start + 3_600, end: start + 7_200, raw: {} },
  ],
});

afterEach(() => vi.restoreAllMocks());

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

  it('keeps the selected TV row within the four full rows (the fifth only peeks)', () => {
    expect(firstVisibleRow(0, 40)).toBe(0);
    expect(firstVisibleRow(3, 40)).toBe(0);
    expect(firstVisibleRow(4, 40)).toBe(1);
    expect(firstVisibleRow(39, 40)).toBe(36);
  });

  it('writes ranges without the day period except once at the end', () => {
    const nine = Date.UTC(2026, 8, 23, 9, 0) / 1000;
    const noon = Date.UTC(2026, 8, 23, 12, 0) / 1000;
    expect(timeRange(nine, noon, 'UTC')).toBe('9:00 – 12:00');
    expect(timeRange(nine, noon, 'UTC', true)).toBe('9:00 – 12:00 PM');
  });
});

describe('Guide', () => {
  it('loads the next channel page at the end of the loaded rows and restores the current timeline', async () => {
    const api = apiFixture();
    const onPlay = vi.fn();
    vi.spyOn(Date, 'now').mockReturnValue(start * 1000);
    const { container } = render(<Guide responsive api={api as unknown as TvApi} onPlay={onPlay} onError={vi.fn()} />);
    await screen.findByRole('button', { name: 'Channel 1' });
    // The responsive guide has no paging controls: the category sidebar
    // narrows channels, and the end of the loaded rows loads the next page.
    expect(screen.queryByRole('button', { name: 'Previous channels' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next channels' })).not.toBeInTheDocument();
    expect(screen.getAllByTestId(/guide-row-/)).toHaveLength(40);
    expect(screen.getByRole('button', { name: 'Channel 40' })).toBeInTheDocument();
    expect(container.querySelector('.vx-live-guide__count')).toHaveTextContent('80 channels');
    const region = screen.getByRole('region', { name: 'Scrollable programme guide' });
    expect(region).toHaveAttribute('tabindex', '0');
    Object.defineProperty(region, 'scrollHeight', { value: 4000, configurable: true });
    Object.defineProperty(region, 'clientHeight', { value: 500, configurable: true });
    region.scrollTop = 3600;
    fireEvent.scroll(region);
    await screen.findByRole('button', { name: 'Channel 41' });
    expect(api.live).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 40 }), expect.anything());
    expect(screen.getAllByTestId(/guide-row-/)).toHaveLength(80);
    fireEvent.click(screen.getByRole('button', { name: 'Channel 42' }));
    expect(onPlay).toHaveBeenLastCalledWith(channels[41]);

    const timeline = container.querySelector('.vx-live-guide__times')!;
    const initialLabels = timeline.textContent;
    const earlier = screen.getByRole('button', { name: 'Earlier' });
    expect(earlier).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Later' }));
    expect(timeline.textContent).not.toBe(initialLabels);
    expect(earlier).not.toBeDisabled();
    expect(container.querySelector('.vx-live-now-line')).not.toBeInTheDocument();
    fireEvent.click(earlier);
    expect(timeline.textContent).toBe(initialLabels);
    fireEvent.click(screen.getByRole('button', { name: 'Later' }));
    fireEvent.click(screen.getByRole('button', { name: 'Now' }));
    expect(timeline.textContent).toBe(initialLabels);
    expect(screen.getByRole('button', { name: 'Now' })).toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelector('.vx-live-now-line')).toBeInTheDocument();
    expect(earlier).toBeDisabled();
  });

  it('scales the desktop timeline in px per minute so wider windows show more hours', async () => {
    const api = apiFixture(schedule);
    vi.spyOn(Date, 'now').mockReturnValue(start * 1000);
    const { container } = render(<Guide responsive api={api as unknown as TvApi} onPlay={vi.fn()} onError={vi.fn()} />);
    const block = await screen.findAllByRole('button', { name: /^Channel 1: Halftime Report/ });
    // 200 px per half hour: a one-hour programme is 400 px wide less the 2 px insets.
    expect(block[0].style.width).toBe('396px');
    const grid = container.querySelector<HTMLElement>('.vx-live-guide__grid')!;
    expect(grid.style.width).toBe('calc(var(--vx-live-channel-w) + 2400px)');
  });

  it('filters categories from the sidebar without remote navigation or arrival focus', async () => {
    const api = apiFixture();
    const onPlay = vi.fn();
    render(<Guide responsive api={api as unknown as TvApi} onPlay={onPlay} onError={vi.fn()} />);
    const first = await screen.findByRole('button', { name: 'Channel 1' });
    expect(first).not.toHaveFocus();
    fireEvent.keyDown(first, { key: 'MediaPlay' });
    expect(onPlay).not.toHaveBeenCalled();
    const categories = screen.getByRole('group', { name: 'Channel categories' });
    fireEvent.click(await within(categories).findByRole('button', { name: 'News, 12 channels' }));
    await waitFor(() => expect(api.live).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'section:news', offset: 0 }), expect.anything()));
    expect(within(categories).getByRole('button', { name: 'News, 12 channels' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(categories).getByRole('button', { name: 'My channels' }));
    await waitFor(() => expect(api.live).toHaveBeenLastCalledWith(expect.objectContaining({ collection: 'favorites', category: undefined, offset: 0 }), expect.anything()));
    expect(within(categories).getByRole('button', { name: 'My channels' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search Live TV' }), { target: { value: '  news  ' } });
    await waitFor(() => expect(api.live).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'news', offset: 0 }), expect.anything()));
  });

  it('opens programme details on the desktop (right-click) with the channel and time slot, and watches from them', async () => {
    const api = apiFixture(schedule);
    const onPlay = vi.fn();
    vi.spyOn(Date, 'now').mockReturnValue(start * 1000);
    render(<Guide responsive api={api as unknown as TvApi} onPlay={onPlay} onError={vi.fn()} />);
    const [airing] = await screen.findAllByRole('button', { name: /^Channel 1: Squawk on the Street/ });
    fireEvent.contextMenu(airing);
    const dialog = await screen.findByRole('dialog', { name: 'Squawk on the Street' });
    expect(dialog).toHaveTextContent(`Channel 1·${timeRange(start - 5_400, start + 3_600, 'UTC')}`);
    expect(dialog).toHaveTextContent('Live business news.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Watch channel now' }));
    expect(onPlay).toHaveBeenLastCalledWith(channels[0]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Clicking an upcoming programme opens its details; Esc closes them.
    const [later] = screen.getAllByRole('button', { name: /^Channel 1: Halftime Report/ });
    fireEvent.click(later);
    expect(await screen.findByRole('dialog', { name: 'Halftime Report' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('phone: tapping plays, long-press opens the channel menu, whose details say when there is no guide', async () => {
    const api = apiFixture();
    const onPlay = vi.fn();
    const onMenu = vi.fn();
    render(<Guide responsive phone api={api as unknown as TvApi} onPlay={onPlay} onError={vi.fn()} onMenu={onMenu} />);
    const row = await screen.findByRole('button', { name: 'Channel 1' });
    fireEvent.click(row);
    expect(onPlay).toHaveBeenLastCalledWith(channels[0]);
    fireEvent.contextMenu(row);
    expect(onMenu).toHaveBeenLastCalledWith(channels[0], expect.any(Function));
    act(() => onMenu.mock.lastCall![1]());
    const sheet = await screen.findByRole('dialog', { name: 'Programme details' });
    expect(sheet).toHaveTextContent('No guide information. You can still watch this channel.');
    fireEvent.click(within(sheet).getAllByRole('button', { name: 'Close' }).at(-1)!);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    // Search sits behind the header button (docked above the nav).
    expect(screen.queryByRole('searchbox', { name: 'Search Live TV' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Search Live TV' }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search Live TV' }), { target: { value: 'news' } });
    await waitFor(() => expect(api.live).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'news' }), expect.anything()));
  });

  it('uses real category filters and keeps five guide rows rendered', async () => {
    const api = apiFixture();
    render(<Guide api={api as unknown as TvApi} onPlay={vi.fn()} onError={vi.fn()} />);

    expect(await screen.findByRole('button', { name: 'News' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByTestId(/guide-row-/)).toHaveLength(5));
    fireEvent.click(screen.getByRole('button', { name: 'News' }));
    await waitFor(() => expect(api.live).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'section:news', offset: 0 }), expect.anything()));
  });

  it('loads the previous forty-channel page and restores focus to its final row', async () => {
    const api = apiFixture();
    render(<Guide api={api as unknown as TvApi} onPlay={vi.fn()} onError={vi.fn()} />);
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
    // The hero names the selected channel with its position in the full list.
    expect(screen.getByText('41 · Channel 41')).toBeInTheDocument();

    const first = screen.getByRole('button', { name: 'Channel 41' });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowUp' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Channel 40' })).toHaveFocus());
  });

  it('moves between the chip row and the grid, and Left at the earliest programme returns to its channel', async () => {
    const api = apiFixture(schedule);
    vi.spyOn(Date, 'now').mockReturnValue(start * 1000);
    render(<Guide api={api as unknown as TvApi} onPlay={vi.fn()} onError={vi.fn()} />);
    const channel = await screen.findByRole('button', { name: 'Channel 1' });
    await waitFor(() => expect(channel).toHaveFocus());
    fireEvent.keyDown(channel, { key: 'ArrowUp' });
    expect(screen.getByRole('button', { name: 'All US channels' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('button', { name: 'All US channels' }), { key: 'ArrowDown' });
    expect(channel).toHaveFocus();

    const [airing] = await screen.findAllByRole('button', { name: /^Channel 1: Squawk on the Street/ });
    airing.focus();
    fireEvent.keyDown(airing, { key: 'ArrowLeft' });
    expect(channel).toHaveFocus();
  });

  it('TV: holding a programme opens the details panel; BACK closes it and restores focus', async () => {
    const api = apiFixture(schedule);
    const back = vi.fn();
    const onPlay = vi.fn();
    vi.spyOn(Date, 'now').mockReturnValue(start * 1000);
    render(
      <RemoteRoot onBack={back}>
        <Guide api={api as unknown as TvApi} onPlay={onPlay} onError={vi.fn()} />
      </RemoteRoot>,
    );
    const [airing] = await screen.findAllByRole('button', { name: /^Channel 1: Squawk on the Street/ });
    airing.focus();
    fireEvent.contextMenu(airing);
    const panel = await screen.findByRole('dialog', { name: 'Squawk on the Street' });
    await waitFor(() => expect(within(panel).getByRole('button', { name: 'Watch channel now' })).toHaveFocus());
    expect(airing).toHaveClass('is-open');
    fireEvent.keyDown(within(panel).getByRole('button', { name: 'Watch channel now' }), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(airing).toHaveFocus());
    expect(back).not.toHaveBeenCalled();
    expect(onPlay).not.toHaveBeenCalled();
  });

  it('uses the remote text entry for a trimmed, bounded live search and handles Back locally', async () => {
    const api = apiFixture();
    const back = vi.fn();
    render(
      <RemoteRoot onBack={back}>
        <Guide api={api as unknown as TvApi} onPlay={vi.fn()} onError={vi.fn()} />
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
