/**
 * Native Roku SceneGraph video adapter with the same surface as the shared
 * `src/video.js` (shaka/DOM) module. Playback is a single `Video` node whose
 * `content` is a `ContentNode`; it is added as the bottom-most child of the
 * shared app root so the SolidTV UI renders on top of it.
 */

import { createElement, insertNode, setProp, tmTransaction } from "@roku-sdk/solid";

import { DownloadedSegments, type BufferedRange } from "./buffered-segments";

import { nativeCaptionStyle, type CaptionAppearance } from "./caption-style";
import { postRokuTask } from "./worker-task";

let captionAppearance: CaptionAppearance = {};
let appliedCaptionStyle = "";
export function applyCaptionAppearance(appearance: CaptionAppearance): void {
  captionAppearance = appearance;
  const style = nativeCaptionStyle(appearance), key = JSON.stringify(style);
  if (video && key !== appliedCaptionStyle) {
    setProp(video, "captionStyle", style);
    appliedCaptionStyle = key;
  }
}
const downloads = new DownloadedSegments();
let segmentEvents = 0;
let lastSegment: (BufferedRange & { kind: number }) | null = null;
/** Read-only decoder timing diagnostics. Contains no URLs or credentials. */
export function playbackStats() {
  return { state: lastState, position: currentPosition, duration: currentDuration,
    segmentEvents, lastSegment, downloaded: downloads.ranges() };
}
const LOG = "ROKU_VIDEO";
const WIDTH = 1920;
const HEIGHT = 1080;
/** How long load() waits for the node to acknowledge a new content URL. */
const ACCEPT_TIMEOUT_MS = 3000;

export const state = {
  playingState: false
};

export type VideoEvent = {
  state: string;
  position: number;
  duration: number;
  bufferedRanges?: BufferedRange[];
  error?: string;
};
const listeners = new Set<(event: VideoEvent) => void>();
export function subscribe(listener: (event: VideoEvent) => void): () => void {
  listeners.add(listener);
  listener({
    state: lastState,
    position: currentPosition,
    duration: currentDuration,
    bufferedRanges: downloads.ranges().map(range => ({ ...range, start: Math.max(currentPosition, range.start) })).filter(range => range.end > range.start),
  });
  return () => listeners.delete(listener);
}
function notify(error?: string) {
  const event = {
    state: lastState,
    position: currentPosition,
    duration: currentDuration,
    bufferedRanges: downloads.ranges().map(range => ({ ...range, start: Math.max(currentPosition, range.start) })).filter(range => range.end > range.start),
    error,
  };
  listeners.forEach((listener) => {
    try { listener(event); } catch (failure) { console.error(LOG + " subscriber failure " + String(failure)); }
  });
}

let video: any = null;
let content: any = null;
let captionsEnabled = false;
let originalCaptionMode: string | undefined;
let pauseOnStart = false;
let warmingPaused = false;
let parent: any = null;
let rootOverride: any = null;
let currentPosition = 0;
let currentDuration = 0;
let lastState = "none";
let activeSession = false;
let backdrop: any = null;
let pendingAccept: (() => void) | null = null;

/** Attach the Video node to an explicit SceneGraph group instead of the app root. */
export function setVideoRoot(root: any): void {
  rootOverride = root || null;
  if (rootOverride && video) attach(rootOverride);
}

/** Event handlers must never throw into the SceneGraph field-change bridge. */
/** This firmware reports position/duration in milliseconds. */
function toSeconds(value: any): number {
  const n = Number(value);
  if (!isFinite(n) || n < 0) return 0;
  return n / 1000;
}

function safe(handler: (value: any) => void) {
  const owner = video;
  return (value: any) => {
    if (video !== owner || !activeSession) return;
    try {
      handler(value);
    } catch (error) {
      console.error(LOG + " handler failure " + String(error));
    }
  };
}

function accept(): void {
  const resolve = pendingAccept;
  pendingAccept = null;
  if (resolve) resolve();
}

function attach(target: any): void {
  parent = target || null;
  if (!video || !parent) return;
  // The shared Player is a full-screen video with no controls. Put the black
  // backdrop and the Video last so they paint over the page background (which
  // otherwise hides the video). The Player unmounts destroy()s them.
  if (backdrop) insertNode(parent, backdrop);
  insertNode(parent, video);
}

function appRoot(): any {
  return (
    rootOverride ||
    (globalThis as any).__viptvVideoLayer ||
    (globalThis as any).__solidtvNativeRoot ||
    null
  );
}

function ensureAttached(): void {
  const target = appRoot();
  if (target && parent !== target) attach(target);
}

/** Only accept a passed-in element if it is a SceneGraph node (an r/t pair). */
function asScenegraphNode(element: any): any {
  return element && element.r !== undefined && typeof element.t === "string" ? element : null;
}

export async function init(element?: any): Promise<void> {
  if (video) {
    ensureAttached();
    return;
  }

  video = createElement("video");
  appliedCaptionStyle = "";
  applyCaptionAppearance(captionAppearance);
  content = createElement("contentNode");
  backdrop = createElement("rectangle");
  setProp(backdrop, "width", WIDTH);
  setProp(backdrop, "height", HEIGHT);
  setProp(backdrop, "translation", [0, 0]);
  setProp(backdrop, "color", "0x000000FF");
  activeSession = true;
  (globalThis as any).__rokuPosLog = 0;

  setProp(video, "width", WIDTH);
  setProp(video, "height", HEIGHT);
  setProp(video, "translation", [0, 0]);
  setProp(video, "enableUI", false);
  setProp(video, "notificationInterval", 1);
  setProp(content, "url", "");
  setProp(video, "content", content);
  ensureAttached();
  setProp(video, "onDownloadedSegment", safe((value: any) => {
    segmentEvents++;
    const range = downloads.observe(value);
    lastSegment = range ? { ...range, kind: Number(value?.segType ?? value?.SegType) } : null;
    notify();
  }));
  setProp(video, "onAvailableSubtitleTracks", safe((tracks: any) => {
    if (!captionsEnabled || !Array.isArray(tracks)) return;
    const name = tracks[0]?.TrackName ?? tracks[0]?.trackName;
    if (typeof name === "string" && name) setProp(video, "subtitleTrack", name);
  }));

  setProp(
    video,
    "onState",
    safe((value: any) => {
      lastState = String(value);
      if (lastState === "playing" && pauseOnStart) {
        pauseOnStart = false;
        lastState = "buffering";
        state.playingState = false;
        setProp(video, "control", "pause");
        return;
      }
      state.playingState = lastState === "playing";
      if (lastState === "paused" && warmingPaused) {
        warmingPaused = false;
        setProp(video, "mute", false);
      }
      if ((!warmingPaused && (lastState === "buffering" || lastState === "playing")) || lastState === "paused") accept();
      if (lastState === "error") console.error(LOG + " state=error");
      notify();
    })
  );
  setProp(
    video,
    "onPosition",
    safe((value: any) => {
      currentPosition = toSeconds(value);
      notify();
    })
  );
  setProp(
    video,
    "onDuration",
    safe((value: any) => {
      currentDuration = toSeconds(value);
      notify();
    })
  );
  setProp(
    video,
    "onErrorCode",
    safe((value: any) => {
      state.playingState = false;
      lastState = "error";
      console.error(LOG + " errorCode=" + String(value));
      notify("Playback error " + String(value));
      accept();
    })
  );
  setProp(
    video,
    "onErrorMsg",
    safe((value: any) => {
      state.playingState = false;
      lastState = "error";
      console.error(LOG + " errorMsg=" + String(value));
      notify(String(value));
      accept();
    })
  );

  const target = rootOverride || asScenegraphNode(element) || appRoot();
  if (!target) {
    console.error(LOG + " init: no SceneGraph root available");
    return;
  }
  attach(target);
}

export async function load(config: { streamUrl: string; captionsEnabled?: boolean; paused?: boolean }): Promise<void> {
  const streamUrl = config && config.streamUrl;
  if (!streamUrl) {
    console.error(LOG + " load: missing streamUrl");
    throw new Error(LOG + " load: missing streamUrl");
  }
  if (!video || !content) {
    console.error(LOG + " load: player not initialized");
    throw new Error("Player not initialized yet");
  }

  ensureAttached();
  const owner = video;
  if (config.captionsEnabled && originalCaptionMode === undefined) {
    let mode: string;
    try {
      mode = await postRokuTask<string>({ op: "caption-mode" }, { timeoutMs: 2500, parent: appRoot() }).result;
    } catch (error) {
      if (video !== owner) throw new DOMException("Playback replaced", "AbortError");
      throw error;
    }
    if (video !== owner || !activeSession) throw new DOMException("Playback replaced", "AbortError");
    if (!["Off", "On", "Instant replay", "When mute"].includes(mode))
      throw new Error("Roku caption setting could not be read.");
    originalCaptionMode = mode;
  }
  // Stop the previous stream first, otherwise the node keeps the old manifest.
  setProp(video, "control", "stop");

  downloads.clear();
  segmentEvents = 0;
  lastSegment = null;
  currentPosition = 0;
  currentDuration = 0;
  lastState = "loading";
  state.playingState = false;
  notify();

  const accepted = new Promise<void>(resolve => {
    pendingAccept = resolve;
  });
  captionsEnabled = config.captionsEnabled === true;
  setProp(video, "suppressCaptions", !captionsEnabled);
  if (captionsEnabled) setProp(video, "globalCaptionMode", "On");
  else if (originalCaptionMode !== undefined) {
    setProp(video, "globalCaptionMode", originalCaptionMode);
    originalCaptionMode = undefined;
  }
  pauseOnStart = config.paused === true;
  warmingPaused = pauseOnStart;
  setProp(video, "autoplayAfterSeek", !pauseOnStart);
  setProp(video, "mute", pauseOnStart);
  setProp(content, "url", streamUrl);
  // Prebuffer immediately instead of waiting three seconds before the first
  // play command. A paused replacement must initialize the decoder first.
  setProp(video, "control", pauseOnStart ? "play" : "prebuffer");
  const timer: any = setTimeout(accept, warmingPaused ? 15000 : ACCEPT_TIMEOUT_MS);
  await accepted;
  if (typeof clearTimeout === "function") clearTimeout(timer);
  if (video !== owner || !activeSession) throw new DOMException("Playback replaced", "AbortError");
  if (config.paused && lastState !== "paused" && lastState !== "error")
    throw new Error("Roku did not acknowledge paused playback.");
}

export function play(): void {
  if (!video) {
    console.error(LOG + " play: player not initialized");
    return;
  }
  ensureAttached();
  setProp(video, "control", lastState === "paused" ? "resume" : "play");
  state.playingState = true;
}

export function pause(): void {
  if (!video) {
    console.error(LOG + " pause: player not initialized");
    return;
  }
  setProp(video, "control", "pause");
  state.playingState = false;
}

export function seek(seconds: number): void {
  downloads.clear();
  if (!video) return;
  const target = typeof seconds === "number" && isFinite(seconds) && seconds > 0 ? seconds : 0;
  setProp(video, "seek", target);
}

export async function destroy(): Promise<void> {
  downloads.clear();
  pauseOnStart = false;
  warmingPaused = false;
  if (video && originalCaptionMode !== undefined)
    setProp(video, "globalCaptionMode", originalCaptionMode);
  originalCaptionMode = undefined;
  if (video) {
    // Clearing `control` starts a transaction, so the removal below is flushed.
    setProp(video, "control", "stop");
    if (parent) tmTransaction.removeNode(parent, video);
  }
  if (backdrop && parent) tmTransaction.removeNode(parent, backdrop);
  backdrop = null;
  activeSession = false;
  lastState = "stopped";
  state.playingState = false;
  notify();
  accept();
  video = null;
  content = null;
  parent = null;
  downloads.clear();
  segmentEvents = 0;
  lastSegment = null;
  currentPosition = 0;
  currentDuration = 0;
  lastState = "loading";
  state.playingState = false;
  notify();
}

export default {
  init,
  load,
  play,
  pause,
  seek,
  state,
  destroy
};
