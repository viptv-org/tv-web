import { describe, expect, it } from 'vitest';

import type { MediaItem, MediaSource } from '../../src/api';
import { exactResumeSource } from '../../src/ui/continuation';

const item: MediaItem = { id: 'movie-1', type: 'movie', name: 'Movie', title: 'Movie', genres: [], episodes: [], raw: {}, sourceAddonId: 'addon-a', sourceFingerprint: 'fingerprint-a' };
const source: MediaSource = { id: 'stream-a', name: 'Source A', sourceAddonId: 'addon-a', raw: { source_fingerprint: 'fingerprint-a' } };

describe('exactResumeSource', () => {
  it('finds Resume only by stable source identity', () => {
    expect(exactResumeSource(item, [source, { ...source, id: 'stream-b', sourceAddonId: 'other' }])).toEqual(source);
    expect(exactResumeSource({ ...item, sourceFingerprint: undefined }, [source])).toBeUndefined();
  });
});
