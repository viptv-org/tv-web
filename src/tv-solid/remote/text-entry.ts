import { createEffect, onCleanup, type Accessor, type Setter } from "solid-js";
import { createTextInput, type TvTextInputEvent } from "./input/text";
import { createNativeTextEditing, nativeTextDialogOverlay, type NativeTextPort, type NativeTextTarget } from "./input/native-text";
import type { RemoteTvApi } from "./api";
import type { Overlay, Screen } from "./app-types";

/** Text entry, in its three forms: the on-screen keyboard, hardware typing and
 * the platform's own text field.
 *
 * All three write the same two targets (`text` inside a prompt, `search` under
 * the search page), and all three finish through `complete`. Keeping them in one
 * module is what stops the native field from having its own idea of when a value
 * is committed.
 */
export function createTextEntry(options: {
  api: RemoteTvApi;
  screen: Accessor<Screen>;
  overlay: Accessor<Overlay | undefined>;
  overlayClosing: Accessor<boolean>;
  screenSaver: Accessor<boolean>;
  zone: Accessor<string>;
  text: Accessor<string>;
  setText: Setter<string>;
  search: Accessor<string>;
  updateSearch: (value: string, immediate?: boolean) => void;
  complete: (isOverlay: boolean) => void;
  dismissOverlay: () => void;
  handleIdleInput: () => boolean;
  notify: (message: string) => void;
}) {
  /** Hardware keystrokes, with the idle saver eating the first one. */
  function textInput(event: TvTextInputEvent) {
    if (options.handleIdleInput()) { event.preventDefault(); return; }
    applyTextInput(event);
  }

  const applyTextInput = createTextInput({
    screen: options.screen, overlay: options.overlay, zone: options.zone,
    text: options.setText, query: options.search, search: options.updateSearch,
    done: () => options.complete(options.overlay()?.kind === "text"),
  });

  const port = (globalThis as { __viptvNativeTextEntry?: NativeTextPort }).__viptvNativeTextEntry;
  const editing = port && createNativeTextEditing(port);

  /** The prompt the platform's own field would edit, if one is open right now. */
  function nativeTarget(): NativeTextTarget | undefined {
    const modal = nativeTextDialogOverlay(options.overlay());
    if (options.screenSaver() || options.overlayClosing() || !modal) return;
    const epoch = options.api.scopeEpoch;
    const current = () =>
      !options.screenSaver() && !options.overlayClosing() && options.overlay() === modal && options.api.scopeEpoch === epoch;
    return {
      key: modal, title: modal.title, value: options.text(), numeric: modal.numeric, secret: modal.secret,
      maximumLength: modal.numeric ? 8 : 2048, confirm: "Done",
      write: (value: string) => { if (current()) textInput({ inputType: "insertReplacementText", data: value, preventDefault() {} }); },
      done: () => { if (current()) options.complete(true); },
      cancel: () => { if (current()) options.dismissOverlay(); },
      failed: () => { if (current()) options.notify("Native keyboard unavailable. Use the on-screen keys."); },
    };
  }

  createEffect(() => editing?.sync(nativeTarget()));
  onCleanup(() => editing?.dispose());

  return { textInput, nativeTarget, editing };
}
