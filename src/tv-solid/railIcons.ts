import { tokens } from "../theme/viptv-tokens.generated";
import { vectorIcon } from "./vectorIcons";

export type RailIcon = "search" | "home" | "discover" | "live" | "list" | "settings";
/** Match the React rail's Lucide paths and stroke geometry. */
export function railIcon(icon: RailIcon, selected = false, onLight = false, expanded = false): string {
  return vectorIcon(icon, tokens[onLight ? "color.on.light" : selected ? "color.text.primary" : expanded ? "color.text.secondary" : "color.text.tertiary"]);
}
