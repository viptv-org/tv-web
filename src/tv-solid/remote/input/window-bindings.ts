import type { Accessor } from "solid-js";
import type { Overlay, Screen } from "../app-types";
import type { TvTextInputEvent } from "./text";

/** The root registers this disposer at the same point as its other host effects. */
export function installWindowInputs(options: {
  keyboard: (event: KeyboardEvent) => void; screen: Accessor<Screen>; overlay: Accessor<Overlay | undefined>;
  textInput?: (event: TvTextInputEvent) => void;
  loading: Accessor<boolean>; error: Accessor<string>; pair: () => Promise<void>; stop: () => Promise<void>;
  next: {advance: () => Promise<void>; dismiss: () => void};
  cancelHold: () => void; cancelCountdown: () => void; visible: (value: boolean) => void; wake: () => void; fail: (error: unknown) => void;
}) {
  const {keyboard: input, screen, overlay, loading, error, pair: beginPairing, stop: leavePlayer, visible: setHeroVisible, wake: reloadIdleImages, fail} = options;
  const {advance: advanceEpisode, dismiss: dismissNext} = options.next;
  const cancelHold = options.cancelHold;
  const textInput = (event: Event) => options.textInput?.(event as unknown as TvTextInputEvent);
  const pointer = (event: PointerEvent) => {
    options.cancelCountdown();
    if (overlay()?.kind !== "next") return;
    const bounds = document.getElementById("app")?.getBoundingClientRect();
    if (!bounds || !bounds.width || !bounds.height) return;
    const x = (event.clientX - bounds.left) * 1920 / bounds.width;
    const y = (event.clientY - bounds.top) * 1080 / bounds.height;
    if (y >= 493 && y <= 565 && x >= 1040 && x <= 1824) {
      if (x <= 1468) void advanceEpisode().catch(fail);
      else if (x >= 1484) dismissNext();
    }
  };
  const cancelCountdown = () => options.cancelCountdown();
  const welcomeClick = (event: MouseEvent) => {
    if (screen() !== "welcome" || loading() || error() || overlay() ||
        document.documentElement.dataset.tvStartup === "failed" || event.button !== 0) return;
    const canvas = document.querySelector<HTMLCanvasElement>("#app canvas");
    const bounds = canvas?.getBoundingClientRect();
    if (!bounds?.width || !bounds.height) return;
    const x = (event.clientX - bounds.left) * 1920 / bounds.width;
    const y = (event.clientY - bounds.top) * 1080 / bounds.height;
    if (x >= 780 && x <= 1140 && y >= 584 && y <= 656) {
      event.preventDefault();void beginPairing();
    }
  };
  window.addEventListener("pointerdown", pointer);
  window.addEventListener("click", welcomeClick);
  window.addEventListener("touchstart", cancelCountdown);
  const suspend = () => {
    cancelHold();
    if (screen() === "player") void leavePlayer().catch(fail);
  };
  let hiddenAt = 0,
    awayAt = Date.now();
  const visibility = () => {
    const visible = document.visibilityState === "visible";
    setHeroVisible(visible);
    if (!visible) {
      hiddenAt = Date.now();
      suspend();
    } else if (hiddenAt && Date.now() - hiddenAt > 5_000) {
      hiddenAt = 0;
      reloadIdleImages();
    }
  };
  const away = () => {
    awayAt = Date.now();
  };
  const back = () => {
    if (Date.now() - awayAt > 30_000) reloadIdleImages();
    awayAt = Date.now();
  };
  const relaunch = () => window.focus();
  window.addEventListener("blur", cancelHold);
  window.addEventListener("blur", away);
  window.addEventListener("focus", back);
  window.addEventListener("keydown", input);
  window.addEventListener("viptvtextinput", textInput);
  window.addEventListener("pagehide", suspend);
  document.addEventListener("visibilitychange", visibility);
  document.addEventListener("webOSRelaunch", relaunch);
  return () => {
    window.removeEventListener("pointerdown", pointer);
    window.removeEventListener("click", welcomeClick);
    window.removeEventListener("touchstart", cancelCountdown);
    window.removeEventListener("keydown", input);
    window.removeEventListener("viptvtextinput", textInput);
    window.removeEventListener("blur", cancelHold);
    window.removeEventListener("blur", away);
    window.removeEventListener("focus", back);
    window.removeEventListener("pagehide", suspend);
    document.removeEventListener("visibilitychange", visibility);
    document.removeEventListener("webOSRelaunch", relaunch);
    cancelHold();
  };
}
