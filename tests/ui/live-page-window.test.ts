import { describe, expect, it } from 'vitest';
import type { LiveCatalogPage, MediaItem } from '../../src/api';
import { LivePageWindow } from '../../src/ui/live-page-window';

function page(index: number, count = 40): LiveCatalogPage {
  return {
    catalogId: 'playlist', generation: 'snapshot',
    nextCursor: index < 9 ? `page_${index + 1}` : null,
    previousCursor: index > 0 ? `page_${index - 1}` : null,
    items: Array.from({ length: count }, (_, slot): MediaItem => ({
      id: `channel-${index * 40 + slot}`, type: 'live', name: 'Channel',
      title: 'Channel', genres: [], episodes: [], raw: {},
    })),
  };
}

describe('live page window', () => {
  it('traverses all pages and retrieves evicted pages in reverse without indexing the playlist', () => {
    const window = new LivePageWindow();
    window.replace(page(0));
    for (let index = 1; index <= 9; index++) {
      expect(window.next).toBe(`page_${index}`);
      expect(window.append(page(index))).toBe(index > 2 ? 40 : 0);
      expect(window.items.length).toBeLessThanOrEqual(120);
      expect(window.start).toBe(Math.max(0, index - 2) * 40);
      expect(window.end).toBe((index + 1) * 40);
    }
    expect(window.next).toBeNull();
    for (let index = 6; index >= 0; index--) {
      expect(window.previous).toBe(`page_${index}`);
      expect(window.prepend(page(index))).toBe(40);
      expect(window.items).toHaveLength(120);
      expect(window.items[0].id).toBe(`channel-${index * 40}`);
      expect(window.start).toBe(index * 40);
      expect(window.end).toBe((index + 3) * 40);
    }
    expect(window.previous).toBeNull();
    expect(window.next).toBe('page_3');
  });

  it('rejects scope changes, empty adjacent pages and repeats without mutating retained rows', () => {
    const window = new LivePageWindow();
    window.replace(page(0));
    for (const invalid of [
      { ...page(1), catalogId: 'other' },
      { ...page(1), generation: 'changed' },
      page(1, 0),
      page(0),
    ]) {
      expect(() => window.append(invalid)).toThrow();
      expect(window.items).toHaveLength(40);
      expect(window.next).toBe('page_1');
      expect(window.start).toBe(0);
      expect(window.end).toBe(40);
    }
  });

  it('resets the complete window on a new filter or playlist', () => {
    const window = new LivePageWindow();
    window.replace(page(0));
    for (let index = 1; index <= 4; index++) window.append(page(index));
    window.replace({ ...page(0, 7), catalogId: 'other', nextCursor: null });
    expect(window.items).toHaveLength(7);
    expect(window.start).toBe(0);
    expect(window.end).toBe(7);
    expect(window.next).toBeNull();
    expect(window.previous).toBeNull();
    window.reset();
    expect(window.items).toEqual([]);
    expect(window.end).toBe(0);
  });
});
