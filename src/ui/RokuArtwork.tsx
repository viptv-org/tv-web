import type { MediaItem, CardPresentation } from "../api";
import { normalizeCore } from "../core";
import { useMemo, useState, type ImgHTMLAttributes, type ReactNode } from "react";

/**
 * Every remote http(s) image routes through the wsrv.nl cache and resize
 * pipeline, whatever the origin host; data:/relative sources stay at origin
 * and network failures fall back to the raw origin URL in the UI.
 */
export function artworkUrl(
  original: string | undefined,
  width: number,
  height: number,
  large = false,
  logo = false,
) {
  return normalizeCore<string | null>("artworkUrl", { original, width, height, large, logo }) ?? undefined;
}
/** Keep failed and not-yet-decoded bitmaps invisible, preserving their layout. */
export function ReadyImage({
  src,
  onLoad,
  onError,
  style,
  ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
  const [loaded, setLoaded] = useState<string>();
  if (!src) return null;
  return (
    <img
      {...props}
      src={src}
      style={{ ...style, visibility: loaded === src ? "visible" : "hidden" }}
      onLoad={(event) => {
        setLoaded(src);
        onLoad?.(event);
      }}
      onError={(event) => {
        setLoaded(undefined);
        onError?.(event);
      }}
    />
  );
}
export function CardArtwork({
  src,
  fallback,
  onError,
}: {
  src?: string;
  fallback: ReactNode;
  onError?: () => void;
}) {
  const [loaded, setLoaded] = useState<string>();
  return (
    <>
      <div className="art-fallback" aria-hidden="true">
        {loaded === src && src ? null : fallback}
      </div>
      <ReadyImage
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(src)}
        onError={() => { setLoaded(undefined); onError?.(); }}
      />
    </>
  );
}
export function HeroArtwork({ uri }: { uri: string }) {
  const [retry, setRetry] = useState(false);
  return (
    <div className="hero-art" aria-hidden="true">
      <ReadyImage
        className="hero-continuity"
        src={artworkUrl(uri, 256, 144)}
        alt=""
      />
      <ReadyImage
        className="hero-sharp"
        src={retry ? uri : artworkUrl(uri, 1280, 720, true)}
        onError={() => {
          if (!retry) setRetry(true);
        }}
        alt=""
      />
      <img
        className="hero-shade-left"
        src={`${import.meta.env.BASE_URL}assets/ui-hero-left.png`}
        alt=""
      />
      <img
        className="hero-shade-bottom"
        src={`${import.meta.env.BASE_URL}assets/ui-hero-bottom.png`}
        alt=""
      />
    </div>
  );
}

/** Network failures are effects; candidate choice remains shared Rust policy. */
export function SharedCardArtwork({ item, context }: { item: MediaItem; context: "queue" | "catalog" }) {
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const [originalRetries, setOriginalRetries] = useState<string[]>([]);
  const presentation = normalizeCore<CardPresentation>("cardPresentation", { item, context, failedImages });
  const original = presentation.image ?? undefined;
  const derivative = artworkUrl(original, 256, 144, false, presentation.imageRole === "logo");
  const src = original && originalRetries.includes(original) ? original : derivative;
  return <CardArtwork src={src} fallback={presentation.title} onError={() => {
    if (!original) return;
    if (src !== original) setOriginalRetries(previous => previous.includes(original) ? previous : [...previous, original]);
    else setFailedImages(previous => previous.includes(original) ? previous : [...previous, original]);
  }} />;
}

export function CardThumbnail({
  src,
  fallback,
  watched,
  progress,
  maxProgress = 1,
  onError,
}: {
  src?: string;
  fallback: ReactNode;
  watched?: boolean;
  progress?: number | null;
  maxProgress?: number;
  onError?: () => void;
}) {
  return (
    <>
      <CardArtwork src={src} fallback={fallback} onError={onError} />
      {watched && <span className="watched-badge">WATCHED</span>}
      {!watched && progress != null && progress > 0 && (
        <progress value={progress} max={maxProgress} />
      )}
    </>
  );
}

export function SharedCardThumbnail({
  item,
  context,
  progress,
  maxProgress = 1,
  watched,
  initial,
}: {
  item: MediaItem;
  context: "queue" | "catalog";
  progress?: number | null;
  maxProgress?: number;
  watched?: boolean;
  /** Caller-computed presentation for the same item+context; recomputed only after an image failure. */
  initial?: CardPresentation;
}) {
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const [originalRetries, setOriginalRetries] = useState<string[]>([]);
  const presentation =
    failedImages.length || !initial
      ? normalizeCore<CardPresentation>("cardPresentation", { item, context, failedImages })
      : initial;
  const original = presentation.image ?? undefined;
  const derivative = useMemo(
    () => artworkUrl(original, 256, 144, false, presentation.imageRole === "logo"),
    [original, presentation.imageRole],
  );
  const src = original && originalRetries.includes(original) ? original : derivative;
  const effectiveProgress = progress !== undefined ? progress : presentation.progress;
  return (
    <CardThumbnail
      src={src}
      fallback={presentation.title}
      watched={watched}
      progress={effectiveProgress}
      maxProgress={maxProgress}
      onError={() => {
        if (!original) return;
        if (src !== original) setOriginalRetries(previous => previous.includes(original) ? previous : [...previous, original]);
        else setFailedImages(previous => previous.includes(original) ? previous : [...previous, original]);
      }}
    />
  );
}
