import type { Accessor, Setter } from "solid-js";
import type { Overlay, Screen } from "../app-types";

export interface TvTextInputEvent {
  inputType: "insertText" | "insertReplacementText" | "deleteContentBackward" | "insertLineBreak";
  data?: string;
  preventDefault(): void;
}

export function createTextInput(options: {
  screen: Accessor<Screen>; overlay: Accessor<Overlay | undefined>; zone: Accessor<string>;
  text: Setter<string>; query: Accessor<string>; search: (value: string) => void;
  done: () => void;
}) {
  return (event: TvTextInputEvent) => {
    const modal = options.overlay();
    if (modal?.kind !== "text" && (modal || options.screen() !== "search" || options.zone() !== "keyboard")) return;
    event.preventDefault();
    if (event.inputType === "insertLineBreak") { options.done(); return; }
    const change = (value: string) => {
      if (event.inputType === "deleteContentBackward") return Array.from(value).slice(0, -1).join("");
      const inserted = event.data ?? "";
      if (/[\u0000-\u001f\u007f-\u009f]/.test(inserted)) return value;
      if (modal?.kind === "text" && modal.numeric && !/^\d*$/.test(inserted)) return value;
      if (event.inputType === "insertReplacementText") {
        return Array.from(inserted).length <= (modal?.kind === "text" && modal.numeric ? 8 : 2048) ? inserted : value;
      }
      return (value + inserted).slice(0, modal?.kind === "text" && modal.numeric ? 8 : 2048);
    };
    if (modal?.kind === "text") options.text(change);
    else options.search(change(options.query()));
  };
}
