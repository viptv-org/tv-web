import type { Profile } from "./types";

export type Screen =
  | "welcome"
  | "pairing"
  | "signed-in"
  | "profiles"
  | "home"
  | "movie"
  | "series"
  | "anime"
  | "calendar"
  | "search"
  | "live"
  | "library"
  | "detail"
  | "settings"
  | "player";
export interface IntegrationSchema {
  plugin_id: string;
  name: string;
  state: string;
  runtime_enabled: boolean;
  credential_fields: {
    id: string;
    label: string;
    secret: boolean;
    required: boolean;
  }[];
  connection_id?: string;
  provider_choices: { id: string; label: string }[];
  maximum_providers: number;
  saved_provider_count?: number;
}
export type Item = {
  id: string;
  label: string;
  value?: string;
  description?: string;
  run: () => void | Promise<void>;
  /** Inline left/right adjustment for display rows (swatches, toggles). */
  cycle?: (direction: number) => void | Promise<void>;
  /** Boolean display rows render the reference toggle instead of a value. */
  toggle?: boolean;
  /** Accent rows render the palette swatches; value is the current hex. */
  swatches?: string[];
  /** Rows opening a value picker carry the boards' trailing chevron. */
  chevron?: boolean;
};
export type Overlay =
  | {
      kind: "choices" | "confirm";
      title: string;
      description?: string;
      items: Item[];
      profile?: Profile;
    }
  | {
      kind: "calibration";
      title: string;
      min: number;
      max: number;
      value: number;
      save: (value: number) => void | Promise<void>;
    }
  | {
      kind: "text";
      title: string;
      secret?: boolean;
      numeric?: boolean;
      initial?: string;
      submit: (value: string) => Promise<void>;
    }
  | { kind: "sources"; title: string }
  | { kind: "next"; title: string; items: Item[] }
  | {
      kind: "tracks";
      title: string;
      columns: { title: string; items: Item[] }[];
    };
