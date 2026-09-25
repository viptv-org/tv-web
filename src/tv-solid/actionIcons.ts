export type ActionIcon = "play" | "pause" | "plus" | "check" | "info" | "settings" | "back10" | "forward30" | "next" | "audio" | "captions" | "exit" | "pencil" | "down";
const names = new Set<ActionIcon>(["play", "pause", "plus", "check", "info", "settings", "back10", "forward30", "next", "audio", "captions", "exit", "pencil", "down"]);

/** Design-pinned Lucide exports, shared by TV controls and navigation. */
export function iconAsset(name: string, variant: "primary" | "secondary" | "focus" = "primary") {
  return `${import.meta.env.BASE_URL}assets/lucide/${name}-${variant}.png`;
}
export function actionIcon(name: ActionIcon, onLight = false): string {
  return iconAsset(name, onLight ? "focus" : "primary");
}
export function actionIconFor(name: string, onLight = false): string {
  return names.has(name as ActionIcon) ? actionIcon(name as ActionIcon, onLight) : "";
}
