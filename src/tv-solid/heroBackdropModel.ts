/** Pure TV-042 backdrop rules shared by the Solid component and its tests. */

/** Logical geometry in the 1920 × 1080 frame. */
export const BACKDROP_WIDTH = 1920;
export const BACKDROP_HEIGHT = 950;
export const ART_WIDTH = 1280;
export const ART_HEIGHT = 720;
/** Details waits this long on an episode before loading its still. */
export const FOCUS_SETTLE_MS = 350;
/** A still narrower than 60% of the art box (768 logical px) shows the series art. */
export const MIN_STILL_WIDTH = Math.round(ART_WIDTH * 0.6);

export type BackdropMode = "shader" | "static";

export interface BackdropModeFacts {
  /** Sources keeps the static compositor so GL never competes with player startup. */
  readonly motion: boolean;
  /** `prefers-reduced-motion: reduce`, evaluated as the screen opens. */
  readonly reducedMotion: boolean;
  /** WebGL 1 unavailable, context/compile failure or context loss this visit. */
  readonly failed: boolean;
}

export function backdropMode(facts: BackdropModeFacts): BackdropMode {
  return facts.motion && !facts.reducedMotion && !facts.failed ? "shader" : "static";
}

export function prefersReducedMotion(view: Pick<Window, "matchMedia"> | undefined = typeof window === "undefined" ? undefined : window): boolean {
  try {
    return typeof view?.matchMedia === "function" && view.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** Decoded art fits inside the art box without upscaling. */
export function artDecodeSize(width: number, height: number): { width: number; height: number } {
  if (!(width > 0 && height > 0)) return { width: 0, height: 0 };
  const scale = Math.min(1, ART_WIDTH / width, ART_HEIGHT / height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function stillFillsArt(decodedWidth: number | undefined): boolean {
  return decodedWidth !== undefined && decodedWidth >= MIN_STILL_WIDTH;
}

export interface BackdropTarget {
  /** The series/movie (or Home hero) art. */
  readonly base: string;
  /** Details: focus rests on an episode (with or without a still). */
  readonly focused: boolean;
  /** That episode's still; empty when it has none. */
  readonly focus: string;
  /** The art the backdrop currently shows. */
  readonly shown: string | undefined;
}

/** Only a focused episode settles; leaving episodes (e.g. a season change)
 * returns to the base art immediately. */
export function settleDelay(target: Pick<BackdropTarget, "focused">): number {
  return target.focused ? FOCUS_SETTLE_MS : 0;
}

/** Whether the focused still must be loaded to decide the subject. */
export function needsStill(target: BackdropTarget): boolean {
  return target.focused && !!target.focus && target.focus !== target.shown;
}

/**
 * Decide the subject after the settle delay and any still decode. A still that
 * decoded wide enough wins; the still already shown stays; otherwise the base
 * art, unless it is blank or already shown. `undefined` keeps the current art.
 */
export function chooseBackdropArt(target: BackdropTarget, stillWidth: number | undefined): string | undefined {
  if (needsStill(target) && stillFillsArt(stillWidth)) return target.focus;
  if (target.focused && target.focus && target.focus === target.shown) return undefined;
  if (!target.base || target.base === target.shown) return undefined;
  return target.base;
}

/** Ground colour as 0–1 RGB for the shaders' `uGround`. */
export function groundRgb(hex: string): [number, number, number] {
  const match = /^#?([0-9a-f]{6})/i.exec(hex.trim());
  const value = match ? parseInt(match[1], 16) : 0;
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

/** Output pixels per logical pixel for the backdrop canvas, never above 1. */
export function backdropScale(viewportWidth: number, devicePixelRatio: number): number {
  const scale = (viewportWidth / BACKDROP_WIDTH) * (devicePixelRatio > 0 ? devicePixelRatio : 1);
  return Number.isFinite(scale) && scale > 0 ? Math.min(1, scale) : 1;
}

/**
 * WebGL 1 has no mipmaps on non-power-of-two textures, so the scene the blur
 * samples is a power-of-two target: the art size rounded up per axis, each
 * axis capped at 1024 for weak TVs (1024 × 1024 for a 1280 × 720 art box).
 */
export function sceneTextureSize(artWidth: number, artHeight: number, maxTextureSize = 4096): { width: number; height: number } {
  const cap = Math.min(1024, maxTextureSize);
  const pot = (value: number) => {
    let size = 1;
    while (size < value && size < cap) size *= 2;
    return Math.min(size, cap);
  };
  return { width: pot(artWidth), height: pot(artHeight) };
}
