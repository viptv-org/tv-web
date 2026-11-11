import type { Card } from "../types";
import type { PreparedEpisode } from "../episode-preparation";

export type PlayIntent = (card: Card, forcePicker?: boolean, restart?: boolean, channel?: string,
  replaceCurrent?: boolean, position?: number, automaticNext?: boolean, prepared?: PreparedEpisode) => Promise<void>;
