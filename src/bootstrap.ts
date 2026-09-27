import { selectRenderer } from "./rendererSelection";
const renderer = selectRenderer(location.search, "__TAURI_INTERNALS__" in window);
document.documentElement.dataset.renderer = renderer;
async function launch() {
if (renderer === "solid") {
  await import("./tv-solid/host.css");
  document.body.innerHTML = '<div id="video-layer"><video id="tv-video" class="video" playsinline preload="auto"></video></div><div id="player-shade"></div><div id="app"></div><div id="solid-preparing-spinner" aria-hidden="true"></div>';
  await import("./tv-solid/main");
} else await import("./main");
}
void launch().catch(() => { document.body.textContent = "VIPTV could not start. Reload to try again."; });
