import { iconAsset } from "./actionIcons";
type Icon = "search" | "home" | "discover" | "live" | "list" | "settings";
export function railIcon(icon: Icon, selected = false, onLight = false): string {
  return iconAsset(icon, onLight ? "focus" : selected ? "primary" : "secondary");
}
