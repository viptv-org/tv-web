import type { MediaItem } from "../api";
import { menuIcon } from "./menuIcons";

export type TitleMenuAction =
  | "previous" | "source" | "watched" | "restart" | "hide" | "favorite" | "cancel"
  | "undo" | "done";
export interface TitleMenuChoiceView {
  key: TitleMenuAction;
  label: string;
  icon: string;
  focusedIcon: string;
  visible: boolean;
}
export const emptyTitleMenuChoice: TitleMenuChoiceView = { key: "cancel", label: "", icon: "", focusedIcon: "", visible: false };

export function titleMenuChoice(key: TitleMenuAction, label: string): TitleMenuChoiceView {
  return { key, label, icon: menuIcon(key), focusedIcon: menuIcon(key, true), visible: true };
}

/** Same action order/copy as the React TV held-card menu. */
export function titleMenuChoices(item: MediaItem, inQueue: boolean, saved: boolean): TitleMenuChoiceView[] {
  const choices: TitleMenuChoiceView[] = [];
  if (item.previousEpisode) choices.push(titleMenuChoice("previous", "Resume previous episode"));
  choices.push(titleMenuChoice("source", "Choose source"));
  choices.push(titleMenuChoice("watched", item.watched ? "Mark unwatched" : "Mark watched"));
  choices.push(titleMenuChoice("restart", "Watch from the beginning"));
  if (inQueue) choices.push(titleMenuChoice("hide", "Remove from Continue Watching"));
  choices.push(titleMenuChoice("favorite", saved ? "Remove from My List" : "Add to My List"));
  choices.push(titleMenuChoice("cancel", "Cancel"));
  return choices;
}
