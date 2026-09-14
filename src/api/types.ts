import type * as Core from '../../vendor/core/typescript/wire';
/** Immutable UI views of the generated Rust DTOs; raw extensions retain the JSON helper type. */
type CoreView<T> = T extends readonly (infer Item)[] ? readonly CoreView<Item>[]
  : T extends object ? { readonly [Key in keyof T]: Key extends 'raw' ? JsonObject : CoreView<T[Key]> } : T;

/** JSON accepted from an add-on after the client removes transport credentials. */
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | readonly JsonValue[];
export interface JsonObject {
  readonly [key: string]: JsonValue | undefined;
}

export type MediaKind = Core.MediaKind;

export type DeviceTokenSet = CoreView<Core.Session>;

export interface DevicePairing {
  readonly deviceCode: string;
  readonly userCode: string;
  readonly verificationUri: string;
  readonly verificationUriComplete: string;
  readonly qrUri: string;
  readonly expiresIn: number;
  readonly intervalSeconds: number;
}

export type TvProfile = CoreView<Core.Profile>;

export type TvAccount = CoreView<Core.Account>;

export type TvIdentity = CoreView<Core.Identity>;

/** Shared card vocabulary used by TV shelves, details, progress and queue. */
export type MediaItem = CoreView<Core.MediaItem>;
export type MediaPresentation = CoreView<Core.MediaPresentation>;
export type CardPresentation = CoreView<Core.CardPresentation>;

export type MediaSource = CoreView<Core.MediaSource>;

export type Catalog = CoreView<Core.Catalog>;

export type CatalogExtra = CoreView<Core.CatalogExtra>;

export interface DiscoverRequest {
  readonly type: string;
  readonly catalog?: string;
  readonly addonId?: number;
  readonly skip?: number;
  readonly search?: string;
  readonly genre?: string;
  readonly extras?: Readonly<Record<string, string>>;
}

export type DiscoverPage = CoreView<Core.DiscoverPage>;

export interface MediaDetail {
  readonly item: MediaItem;
  readonly episodes: readonly MediaItem[];
}
export interface Page<T> {
  readonly items: readonly T[];
  readonly offset: number;
  readonly total: number;
  readonly nextOffset: number | null;
}

export interface StreamDiscovery {
  readonly id: string;
}
export interface StreamEvent {
  readonly sequence: number;
  readonly source: string;
  readonly sources: readonly MediaSource[];
  readonly error?: string;
}
export interface StreamPoll {
  readonly events: readonly StreamEvent[];
  readonly done: boolean;
}

/** A WebCodecs demuxer path: the original container is served instead of HLS. */
export interface DirectFileCapabilities {
  readonly directFiles?: boolean;
  readonly directVideoCodecs?: readonly string[];
  readonly directAudioCodecs?: readonly string[];
}

export interface PlaybackCapabilities extends DirectFileCapabilities {
  readonly maxWidth: number;
  readonly maxHeight: number;
  readonly h264: boolean;
  readonly hevc: boolean;
  readonly aac: boolean;
  readonly directPlay: boolean;
  readonly directMp4?: boolean;
  readonly directHls?: boolean;
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
export type PlaybackSession = CoreView<Core.PlaybackSession>;
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
export interface GuideProgram {
  readonly title: string;
  readonly start: number;
  readonly end: number;
  readonly description?: string;
  readonly raw: JsonObject;
}
export interface Guide {
  readonly programs: readonly GuideProgram[];
  readonly timezone: string;
  readonly timeline?: readonly {
    readonly time: number;
    readonly displayTime: string;
  }[];
}
export interface LivePage {
  readonly channels: readonly MediaItem[];
  readonly total: number;
}
/** A guide category is a filter, not playable media. */
export interface LiveCategory {
  readonly id: string;
  readonly name: string;
  readonly count: number;
  readonly raw: JsonObject;
}
export interface LiveCategories {
  readonly categories: readonly LiveCategory[];
  readonly total: number;
}
export interface ParentStatus {
  readonly configured: boolean;
  readonly unlocked: boolean;
  readonly restricted: boolean;
  readonly raw: JsonObject;
}
export interface ParentPinChange {
  readonly pin: string;
  readonly currentPin?: string;
}

export interface TvApiErrorShape {
  readonly status: number;
  readonly code?: string;
  readonly message: string;
}
