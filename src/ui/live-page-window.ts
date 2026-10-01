import type { LiveCatalogPage, MediaItem } from '../api';
import { TvApiError } from '../api/client-shared';

/** Renderer cache, not a playlist index. Reverse cursors make evicted pages retrievable. */
export class LivePageWindow {
  private pages: LiveCatalogPage[] = [];
  start = 0;
  end = 0;
  reset(): void { this.pages = []; this.start = 0; this.end = 0; }
  get items(): readonly MediaItem[] { return this.pages.flatMap(page => [...page.items]); }
  get next(): string | null { return this.pages.at(-1)?.nextCursor ?? null; }
  get previous(): string | null { return this.pages[0]?.previousCursor ?? null; }
  replace(page: LiveCatalogPage): void { this.reset(); this.pages = [page]; this.end = page.items.length; }
  append(page: LiveCatalogPage): number {
    this.check(page);
    this.pages.push(page); this.end += page.items.length;
    const removed = this.pages.length > 3 ? this.pages.shift()!.items.length : 0;
    this.start += removed;
    return removed;
  }
  prepend(page: LiveCatalogPage): number {
    this.check(page);
    this.pages.unshift(page); this.start = Math.max(0, this.start - page.items.length);
    const removed = this.pages.length > 3 ? this.pages.pop()!.items.length : 0;
    this.end -= removed;
    return removed;
  }
  private check(page: LiveCatalogPage): void {
    const first = this.pages[0];
    if (first && (first.catalogId !== page.catalogId || first.generation !== page.generation))
      throw new TvApiError(409, 'This playlist changed while you were browsing. Reload the guide.', 'catalog_changed');
    if (!page.items.length) throw new TvApiError(409, 'This playlist changed while you were browsing. Reload the guide.', 'catalog_changed');
    const known = new Set(this.items.map(item => item.id));
    if (page.items.some(item => known.has(item.id))) throw new TvApiError(502, 'The server repeated a live playlist page. Reload the guide.', 'invalid_catalog_response');
  }
}
