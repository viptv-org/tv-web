import Hls from 'hls.js';
import type { PlaybackCapabilities } from '../api/types';

export const BROWSER_CODECS = {
  h264: 'video/mp4; codecs="avc1.640029"',
  hevc: 'video/mp4; codecs="hvc1.1.6.L150.B0"',
  aac: 'audio/mp4; codecs="mp4a.40.2"',
} as const;
export const HLS_MIME_TYPES = ['application/vnd.apple.mpegurl', 'application/x-mpegURL'] as const;
export interface BrowserProbeEnvironment {
  readonly media: { canPlayType(type: string): string };
  readonly decodingInfo?: (configuration: MediaDecodingConfiguration) => Promise<MediaCapabilitiesDecodingInfo>;
  readonly mseSupported: boolean;
  readonly mseTypeSupported: (type: string) => boolean;
  readonly timeoutMs?: number;
}
export interface BrowserPlaybackProbe {
  readonly capabilities: PlaybackCapabilities;
  readonly canPlayManagedHls: boolean;
  readonly protocols: { readonly nativeHls: boolean; readonly mseHls: boolean; readonly selectedHls: 'native' | 'mse' | 'unsupported' };
  readonly evidence: readonly string[];
}
export function supportsNativeHls(media: { canPlayType?(type: string): string }): boolean {
  return HLS_MIME_TYPES.some((type) => { try { return !!media.canPlayType?.(type); } catch { return false; } });
}

/** Probe the actual HTML decoding paths. WebCodecs is deliberately not evidence for this player. */
export async function probeBrowserPlaybackCapabilities(environment?: BrowserProbeEnvironment): Promise<BrowserPlaybackProbe> {
  const source = typeof MediaSource === 'undefined' ? undefined : MediaSource;
  const env = environment ?? {
    media: document.createElement('video'),
    decodingInfo: navigator.mediaCapabilities?.decodingInfo.bind(navigator.mediaCapabilities),
    mseSupported: Hls.isSupported(),
    mseTypeSupported: (type: string) => source?.isTypeSupported(type) ?? false,
  };
  const evidence: string[] = [];
  const nativeHls = supportsNativeHls(env.media);
  const mseHls = !nativeHls && env.mseSupported;
  const selectedHls = nativeHls ? 'native' : mseHls ? 'mse' : 'unsupported';
  async function codec(name: keyof typeof BROWSER_CODECS, path: 'file' | 'media-source'): Promise<boolean> {
    const mime = BROWSER_CODECS[name];
    let hint = false;
    try { hint = path === 'file' ? !!env.media.canPlayType(mime) : env.mseTypeSupported(mime); } catch { /* unsupported API */ }
    if (!hint) { evidence.push(`${path}:${name}:mime-unsupported`); return false; }
    if (!env.decodingInfo) { evidence.push(`${path}:${name}:mime-supported; decodingInfo-unavailable`); return true; }
    const configuration: MediaDecodingConfiguration = name === 'aac'
      ? { type: path, audio: { contentType: mime, channels: '2', bitrate: 192000, samplerate: 48000 } }
      : { type: path, video: { contentType: mime, width: 1920, height: 1080, bitrate: 8000000, framerate: 30 } };
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        Promise.resolve().then(() => env.decodingInfo!(configuration)),
        new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), env.timeoutMs ?? 1000); }),
      ]);
      evidence.push(`${path}:${name}:${result === null ? 'decodingInfo-timeout; mime-supported' : `decodingInfo-${result.supported ? 'supported' : 'unsupported'}; smooth=${result.smooth}; powerEfficient=${result.powerEfficient}`}`);
      return result === null ? hint : result.supported;
    } catch {
      evidence.push(`${path}:${name}:decodingInfo-unavailable; mime-supported`);
      return hint;
    } finally { clearTimeout(timer); }
  }
  const [nativeH264, nativeHevc, nativeAac, mseH264, mseHevc, mseAac] = await Promise.all([
    codec('h264', 'file'), codec('hevc', 'file'), codec('aac', 'file'),
    mseHls ? codec('h264', 'media-source') : false,
    mseHls ? codec('hevc', 'media-source') : false,
    mseHls ? codec('aac', 'media-source') : false,
  ]);
  const h264 = nativeHls ? nativeH264 : mseHls && mseH264;
  const aac = nativeHls ? nativeAac : mseHls && mseAac;
  const hevc = nativeHevc && (nativeHls || (mseHls && mseHevc));
  const directMp4 = nativeH264 && nativeAac;
  const canPlayManagedHls = h264 && aac;
  evidence.push(`hls:${selectedHls}`, 'sample:1080p30; h264-high-4.1; hevc-main-5.0-sdr; aac-lc-stereo');
  return {
    capabilities: { maxWidth: 1920, maxHeight: 1080, h264, hevc, aac, directPlay: directMp4 || canPlayManagedHls, hevcSdr: hevc, directMp4, directHls: canPlayManagedHls },
    canPlayManagedHls,
    protocols: { nativeHls, mseHls, selectedHls }, evidence,
  };
}
