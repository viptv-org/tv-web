import { selectRenderer } from "./rendererSelection";
const renderer = selectRenderer(location.search, "__TAURI_INTERNALS__" in window);
document.documentElement.dataset.renderer = renderer;

async function launch() {
if (renderer === "solid") {
  await import("./tv-solid/host.css");
  document.getElementById('root')?.remove();
  document.body.insertAdjacentHTML('beforeend', '<div id="video-layer"><video id="tv-video" class="video" playsinline preload="auto"></video></div><div id="player-shade"></div><div id="app"></div><div id="solid-preparing-spinner" aria-hidden="true"></div>');
  await import("./tv-solid/main");
} else await import("./main");
}
void launch().catch((cause) => {
  console.error("VIPTV launch failed", cause);
  if (renderer === "solid") window.dispatchEvent(new Event("viptv:startup-failed"));
  else document.body.textContent = "VIPTV could not start. Reload to try again.";
});
