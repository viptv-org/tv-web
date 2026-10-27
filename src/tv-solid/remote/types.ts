/** Unversioned server contracts. No provider normalization or business policy lives here. */
export interface Identity {
  kind: string;
  id: string;
  ids: { namespace: string; value: string }[];
  episode?: { order: string; season?: number; episode: number } | null;
}
export interface Card {
  view?: {
    saved: boolean;
    metadata_parts?: string[];
    hero_metadata_parts?: string[];
    hero_badges?: { label: string; role: string }[];
    compact_metadata_parts?: string[];
    badges?: { label: string; role: string }[];
    tile_badge?: { label: string; role: string } | null;
    progress?: number | null;
    preview?: {
      background: string | null;
      caption: string | null;
      progress: number | null;
      action: "play" | "details";
    };
  };
  identity: Identity;
  parent_identity?: Identity | null;
  metadata_origin?: Record<string, unknown> | null;
  provider_id: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  poster?: string | null;
  landscape?: string | null;
  logo?: string | null;
  progress?: number | null;
  badges: string[];
  metadata?: {
    year?: number;
    runtime_minutes?: number;
    genres: string[];
    rating?: number;
    certification?: string;
  };
}
export interface Page {
  cards: Card[];
  next_cursor?: string | null;
  complete: boolean;
}
export type LibraryQuery = Record<string, string | number | null>;
export interface LibraryPage extends Page {
  query?: LibraryQuery;
  default_query?: LibraryQuery;
  controls?: Control[];
  availability?: string;
  reason?: string | null;
  refresh_after_millis?: number | null;
}
export interface Row {
  view?: { card_shape: "landscape" | "poster" };
  id: string;
  title: string;
  state: "Pending" | "Ready" | "Empty" | "Failed";
  cards: Card[];
  next_cursor?: string | null;
  message?: string | null;
  browse?: { target: string; query: { id: string; values: string[] }[] } | null;
}
export interface Home {
  hero?: Card | null;
  featured: Card[];
  rows: Row[];
  complete: boolean;
  revision: number;
}
export interface Detail {
  item: Card;
  episodes: Card[];
  recommendations: Card[];
  seasons: { season: number; episode_count: number; offset: number }[];
  next_cursor?: string | null;
}
export interface Capability {
  availability: string;
  message?: string | null;
}
export interface Profile {
  id: string;
  name: string;
  avatar_id?: string | null;
  locked: boolean;
  can_delete: boolean;
  selection_requires_parent: boolean;
}
export interface Management {
  profiles: Profile[];
  avatar_ids: string[];
  capabilities: Record<string, Capability>;
  parent: { pin_configured: boolean; unlocked: boolean; restricted: boolean };
}
export interface DisplayPreferences {
  accent_color: string;
  show_ratings: boolean;
  text_size: "small" | "default" | "large";
  reduce_motion: "follow" | "on" | "off";
  screen_saver_minutes: number;
  screen_inset: number;
}
export interface Preferences {
  controls?: {
    id: string;
    group: string;
    label: string;
    description?: string;
    kind?: string;
    min?: number;
    max?: number;
    step?: number;
    choices?: { label: string; value: string | number | boolean | null }[];
  }[];
  revision: number;
  preferences: Record<string, string | number | boolean | null>;
  display?: DisplayPreferences;
}
export interface Bootstrap {
  contract_version: number;
  navigation?: {
    id: string;
    label: string;
    media_search?: boolean;
    channel_search?: boolean;
  }[];
  identity: {
    profile_id?: string | null;
    account?: { id: string; name: string; username: string };
  };
  profile_management: Management;
  home?: Home | null;
  library?: Page | null;
  preferences?: Preferences | null;
  revisions?: Record<string, number | string>;
  integrations: { id: string; capabilities: string[] }[];
}
export interface Pairing {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_in: number;
  interval: number;
}
export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
  accountId?: string;
  sessionId?: string;
}
export interface Source {
  view?: {
    title: string;
    body?: string | null;
    quality_label?: string | null;
    format_label?: string;
    addon_label?: string | null;
    provider_label?: string | null;
  };
  id: string;
  name?: string;
  title?: string;
  detail?: string;
  description?: string;
  quality_height?: number;
  presentation?: { quality?: string; [key: string]: unknown };
}
export interface Control {
  id: string;
  label: string;
  kind: string;
  choices: { value: string; label: string }[];
  maximum_selections?: number;
  required: boolean;
}
export interface Catalog {
  id: string;
  name: string;
  type: string;
  addon_id?: number;
  controls: Control[];
  connection_name?: string;
}
export interface Controls {
  controls: Control[];
  catalogs: Catalog[];
  discovery: Capability;
  search: Capability;
}
export interface Channel {
  id: string;
  connection_id: string;
  card: Card;
  group_id?: string;
}
export interface LivePage {
  snapshot_id: string;
  paging: {
    origin: string;
    limit: number;
    page_size: number;
    previous: LivePageRequest | null;
    next: LivePageRequest | null;
  };
  channels: Channel[];
  groups: { id: string; label: string }[];
  next_cursor?: string | null;
  complete: boolean;
  availability: string;
  reason?: string;
}
export interface LivePageRequest {
  cursor: string;
  limit: number;
  page_size: number;
}
export interface Program {
  id: string;
  title: string;
  description?: string;
  start_millis: number;
  end_millis: number;
}
export interface ServerTrack {
  input_index: number;
  title?: string;
  language?: string;
  selected?: boolean;
  selectable?: boolean;
  supported?: boolean;
}
export interface Delivery {
  subtitle_appearance?: {
    font_scale: number;
    text_color: string;
    background_color: string;
  };
  audio_tracks?: ServerTrack[];
  subtitle_tracks?: ServerTrack[];
  subtitles_supported?: boolean;
  kind: "gateway" | "direct";
  url: string;
  format: string;
  position?: number;
  timeline_offset_seconds?: number;
  duration?: number;
  live?: boolean;
  headers?: Record<string, string>;
}
export interface Lease {
  id: string;
  status: string;
  delivery?: Delivery;
  renew_after_seconds: number;
  expires_at?: number;
  actions?: PlaybackActions;
}
export interface PlaybackActions {
  pause: boolean;
  seek: boolean;
  restart: boolean;
  change_source: boolean;
  episodes: boolean;
  next_episode: boolean;
  tracks: boolean;
  subtitle_style: boolean;
  report_progress: boolean;
}
export interface SourceReplacement {
  playback_id: string;
  observed_position: number;
}
export interface TitleAction {
  card: Card;
  label: string;
  resume: boolean;
  source_selection: "best" | "ask";
  progress?: number | null;
  remaining_label?: string | null;
}
export const cardKey = (card: Card) =>
  JSON.stringify([
    card.metadata_origin ?? card.provider_id,
    card.identity.kind,
    card.identity.id,
  ]);

export interface SourcePage {
  action?: TitleAction;
  selection_note?: string;
  streams: Source[];
  best_match_id?: string | null;
  quality_filters: { height: number; label: string; count: number }[];
  total: number;
}

export interface Guide {
  view?: {
    current_program_id?: string | null;
    now_millis: number;
    window_start_millis: number;
    window_end_millis: number;
  };
  programs: Program[];
}

export interface SourcePage {
  streams: Source[];
  best_match_id?: string | null;
  quality_filters: { height: number; label: string; count: number }[];
  total: number;
}

export interface SourcePage {
  streams: Source[];
  best_match_id?: string | null;
  quality_filters: { height: number; label: string; count: number }[];
  total: number;
}
