import { expect, it } from 'vitest';
import { normalizeCore } from '../../src/core';
import { enrichDetail } from '../../src/ui/detailProgress';
import type { MediaItem } from '../../src/api';

it('uses enriched title backdrop for the hero and never promotes a portrait', () => {
  const saved: MediaItem = { id: 'episode-2', type: 'series', seriesId: 'series-1', name: 'Series', title: 'Series', genres: [], episodes: [], poster: 'https://images.example/poster.jpg', sourceAddonId: 'iptv:2', sourceFingerprint: 'exact', position: 42, raw: {} };
  expect(normalizeCore<{ heroImage: string | null }>('presentation', saved).heroImage).toBeNull();
  const enriched = enrichDetail(saved, { id: 'series-1', type: 'series', name: 'Series', title: 'Series', genres: [], episodes: [], background: 'https://images.example/backdrop.jpg', raw: {} });
  expect(normalizeCore<{ heroImage: string | null }>('presentation', enriched).heroImage).toBe('https://images.example/backdrop.jpg');
  expect(enriched.sourceFingerprint).toBe('exact');
  expect(enriched.position).toBe(42);
});
