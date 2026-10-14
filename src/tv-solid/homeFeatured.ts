import type { MediaItem } from '../api';
import { identityKey, itemIdentity } from '../api/engine-card';
import { projectHome, type HomeView } from './homeModel';

export const featuredKey = (item: MediaItem | null) => item ? identityKey(itemIdentity(item)) : '';

export function nextFeatured(home: HomeView): MediaItem | undefined {
  const titles = home.featured ?? [];
  if (titles.length < 2) return;
  const index = titles.findIndex(item => featuredKey(item) === featuredKey(home.heroItem));
  return titles[(index + 1) % titles.length];
}

/** Rotate existing host projections without detail requests or changing shelf state. */
export function projectFeatured(home: HomeView, item: MediaItem): HomeView {
  return { ...projectHome(item, home.queueItems, undefined, home.favoriteItems),
    featured: home.featured, savedFeatured: home.savedFeatured,
    saved: home.savedFeatured?.includes(featuredKey(item)) ?? home.favoriteItems.some(value => featuredKey(value) === featuredKey(item)) };
}
