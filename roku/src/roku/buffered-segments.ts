export type BufferedRange = { start: number; end: number };

function merge(ranges: readonly BufferedRange[]): BufferedRange[] {
  const result: BufferedRange[] = [];
  for (const range of [...ranges].sort((a, b) => a.start - b.start)) {
    const previous = result[result.length - 1];
    if (previous && range.start <= previous.end + 0.01)
      previous.end = Math.max(previous.end, range.end);
    else result.push({ ...range });
  }
  return result.slice(-128);
}

/** Actual SceneGraph downloadedSegment times; buffering fill is not a duration. */
export class DownloadedSegments {
  private mux: BufferedRange[] = [];
  private video: BufferedRange[] = [];
  private audio: BufferedRange[] = [];

  clear() { this.mux = []; this.video = []; this.audio = []; }

  observe(value: any): BufferedRange | undefined {
    if (!value || Number(value.Status ?? value.status) !== 0) return;
    // The JS SDK reports segStartTime in milliseconds; the legacy SceneGraph
    // dictionary's SegStart field is in seconds.
    const sdkStart = value.segStartTime ?? value.SegStartTime;
    const start = sdkStart !== undefined ? Number(sdkStart) / 1000
      : Number(value.SegStart ?? value.segStart ?? value.segstart);
    // SegStart is seconds; SegDuration is milliseconds in SceneGraph's API.
    const duration = Number(value.SegDuration ?? value.segDuration ?? value.segduration) / 1000;
    const kind = Number(value.SegType ?? value.segType ?? value.segtype);
    if (!Number.isFinite(start) || start < 0 || !Number.isFinite(duration) || duration <= 0) return;
    const range = { start, end: start + duration };
    if (kind === 0) this.mux = merge([...this.mux, range]);
    if (kind === 1) this.audio = merge([...this.audio, range]);
    if (kind === 2) this.video = merge([...this.video, range]);
    return kind === 0 || kind === 1 || kind === 2 ? range : undefined;
  }

  ranges(): BufferedRange[] {
    if (!this.audio.length) return merge([...this.mux, ...this.video]);
    const complete: BufferedRange[] = [];
    let videoIndex = 0, audioIndex = 0;
    while (videoIndex < this.video.length && audioIndex < this.audio.length) {
      const video = this.video[videoIndex], audio = this.audio[audioIndex];
      const start = Math.max(video.start, audio.start), end = Math.min(video.end, audio.end);
      if (end > start) complete.push({ start, end });
      if (video.end <= audio.end) videoIndex++; else audioIndex++;
    }
    return merge([...this.mux, ...complete]);
  }
}
