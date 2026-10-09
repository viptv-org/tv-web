import { selectRenderer } from "./rendererSelection";
const renderer = selectRenderer(location.search, "__TAURI_INTERNALS__" in window);
document.documentElement.dataset.renderer = renderer;

/**
 * Hosted-TV containers (Vizio SmartCast Conjure, and some Tizen/webOS shells)
 * can deliver the remote's BACK as browser history navigation instead of a
 * key event. The TV entries are single-page sessions with no in-app history
 * stack, so an unguarded history back would leave the app document entirely
 * (about:blank → the reported full black screen). Push one sentinel entry and
 * treat any popstate that lands on it as a BACK keypress for the renderer.
 * The renderer layer owns the actual key handling; the sentinel only keeps
 * the app document alive and re-arms after each pop.
 */
if (renderer === "solid") {
  const sentinel = { viptvHistorySentinel: true as const };
  history.replaceState(sentinel, "", location.href);
  history.pushState(sentinel, "", location.href);
  window.addEventListener("popstate", () => {
    // Consume the pop on the sentinel entry and immediately re-arm it, so
    // the next history back lands on the sentinel again instead of exiting.
    history.pushState(sentinel, "", location.href);
    // The solid runtime's key map resolves through the legacy keyCode field
    // too (old TV Chromium builds), which a synthetic KeyboardEvent does not
    // fill: set the webOS/Vizio Back keyCode explicitly.
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "GoBack", keyCode: 461, bubbles: true, cancelable: true }));
  });
}

async function launch() {
if (renderer === "solid") {
  await import("./tv-solid/host.css");
  document.body.innerHTML = '<div id="video-layer"><video id="tv-video" class="video" playsinline preload="auto"></video></div><div id="player-shade"></div><div id="app"></div><div id="solid-preparing-spinner" aria-hidden="true"></div>';
  await import("./tv-solid/main");
} else await import("./main");
}
void launch().catch(() => { document.body.textContent = "VIPTV could not start. Reload to try again."; });
