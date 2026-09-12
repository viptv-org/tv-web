/** JSON accepted from an add-on after the client removes transport credentials. */
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject { readonly [key: string]: JsonValue | undefined; }

export type MediaKind = "movie" | "series" | "live";

export interface DeviceTokenSet {
  readonly sessionId: string;
  readonly accountId: string;
  readonly profileId: string | null;
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
}

export interface DevicePairing {
  readonly deviceCode: string;
  readonly userCode: string;
  readonly verificationUri: string;
  readonly verificationUriComplete: string;
  readonly qrUri: string;
  readonly expiresIn: number;
  readonly intervalSeconds: number;
}

export interface TvProfile {
  readonly id: string;
  readonly name: string;
  readonly avatar?: string;
  readonly kid?: boolean;
  readonly setupComplete?: boolean;
  readonly raw: JsonObject;
}

export interface TvAccount {
  readonly id: string;
  readonly username: string;
  readonly name: string;
  readonly role: string;
}

export interface TvIdentity {
  readonly account: TvAccount;
  readonly profiles: readonly TvProfile[];
  readonly profileId: string | null;
  readonly restricted: boolean;
  readonly profileSetupRequired: boolean;
}

/** Shared card vocabulary used by TV shelves, details, progress and queue. */
export interface MediaItem {
  readonly id: string;
  readonly type: MediaKind;
  readonly name: string;
  readonly title: string;
  readonly poster?: string;
  readonly background?: string;
  readonly description?: string;
  readonly year?: number;
  readonly runtime?: string;
  readonly genres: readonly string[];
  readonly position?: number;
  readonly duration?: number;
  readonly watched?: boolean;
  readonly season?: number;
  readonly episode?: number;
  readonly seriesId?: string;
  readonly queueStatus?: string;
  readonly previousEpisode?: MediaItem;
  readonly sourceAddonId?: string;
  readonly sourceName?: string;
  readonly sourceFingerprint?: string;
  readonly sourceBingeGroup?: string;
  readonly sourceReleaseGroup?: string;
  readonly sourceQuality?: string;
  readonly sourceAudio?: string;
  /** Non-secret add-on metadata. URL, headers and authorization are always removed. */
  readonly raw: JsonObject;
}

export interface MediaSource {
  readonly id: string;
  readonly name: string;
  readonly title?: string;
  readonly filename?: string;
  readonly sourceAddonId?: string;
  readonly sourceName?: string;
  readonly quality?: string;
  readonly audio?: string;
  readonly raw: JsonObject;
}

export interface Catalog {
  readonly id: string;
  readonly name: string;
  readonly type: MediaKind;
  readonly addonId?: number;
  readonly supportsSearch: boolean;
  readonly supportsSkip: boolean;
  readonly raw: JsonObject;
}

export interface DiscoverRequest {
  readonly type: MediaKind;
  readonly catalog?: string;
  readonly addonId?: number;
  readonly skip?: number;
  readonly search?: string;
  readonly genre?: string;
  readonly extras?: Readonly<Record<string, string>>;
}

export interface DiscoverPage {
  readonly items: readonly MediaItem[];
  readonly hasMore: boolean;
  readonly nextSkip?: number;
}

export interface MediaDetail { readonly item: MediaItem; readonly episodes: readonly MediaItem[]; }
export interface Page<T> { readonly items: readonly T[]; readonly offset: number; readonly total: number; readonly nextOffset: number | null; }

export interface StreamDiscovery { readonly id: string; }
export interface StreamEvent { readonly sequence: number; readonly source: string; readonly sources: readonly MediaSource[]; readonly error?: string; }
export interface StreamPoll { readonly events: readonly StreamEvent[]; readonly done: boolean; }

export interface PlaybackCapabilities {
  readonly maxWidth: number;
  readonly maxHeight: number;
  readonly h264: boolean;
  readonly hevc: boolean;
  readonly aac: boolean;
  readonly directPlay: boolean;
  readonly hevcSdr: boolean;
}
export interface MediaTrack {
  readonly inputIndex: number;
  readonly codec?: string;
  readonly language?: string;
  readonly languageStatus: string;
  readonly title: string;
  readonly selected: boolean;
  readonly supported: boolean;
  readonly selectable: boolean;
}
/** The URL is a short-lived server capability, never an upstream media URL. Do not persist it. */
export interface PlaybackSession {
  readonly id: string;
  readonly url: string;
  readonly format: string;
  readonly mode: string;
  readonly videoMode: string;
  readonly audioMode: string;
  readonly position: number;
  readonly live: boolean;
  readonly duration: number;
  readonly audioTracks: readonly MediaTrack[];
  readonly subtitleTracks: readonly MediaTrack[];
  readonly subtitlesSupported: boolean;
}
export interface PlaybackStart {
  readonly streamId?: string;
  readonly channelId?: string;
  readonly position?: number;
  readonly capabilities: PlaybackCapabilities;
  readonly forceTranscode?: boolean;
  readonly managedOnly?: boolean;
  readonly audioTrackIndex?: number;
  readonly audioLanguage?: string;
  readonly subtitleTrackIndex?: number;
  readonly subtitlesOff?: boolean;
  readonly startupId?: string;
}

export interface PlaybackPreferences {
  readonly audioLanguage: string;
  readonly subtitleLanguage: string;
  readonly subtitlesEnabled: boolean;
  readonly subtitleSize: "small" | "normal" | "large";
  readonly subtitleStyle: "system" | "shadow" | "opaque";
  readonly quality: "auto" | "1080p" | "720p" | "480p";
  readonly autoplay: boolean;
}
export interface GuideProgram { readonly title: string; readonly start: number; readonly end: number; readonly description?: string; readonly raw: JsonObject; }
export interface Guide { readonly programs: readonly GuideProgram[]; readonly timezone: string; }
export interface LivePage { readonly channels: readonly MediaItem[]; readonly total: number; }
export interface ParentStatus { readonly configured: boolean; readonly unlocked: boolean; readonly restricted: boolean; readonly raw: JsonObject; }
export interface ParentPinChange { readonly pin: string; readonly currentPin?: string; }

export interface TvApiErrorShape { readonly status: number; readonly code?: string; readonly message: string; }
