import type { MediaItem, CardPresentation } from "../api";
import { artworkUrl, cardPresentation, presentation } from "../core/presentations";
export { artworkUrl };
import { useMemo, useState, type ImgHTMLAttributes, type ReactNode } from "react";

/**
 * Every remote http(s) image routes through the wsrv.nl cache and resize
 * pipeline, whatever the origin host; data:/relative sources stay at origin
 * and network failures fall back to the raw origin URL in the UI.
 * Results are cached per argument set in core/presentations.
 */
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
/**
 * TV Home backdrop (reference TvHome): the hero art as a blurred ambient
 * fill plus the sharp art at the top right, faded into the ground by a left
 * mask and the left / bottom scrims. The sharp layer is the 1280 × 720
 * derivative (retried at its origin once); the ambient layer reuses the small
 * card derivative, which the blur hides.
 */
export function HeroArtwork({ uri }: { uri: string }) {
  const [retry, setRetry] = useState(false);
  return (
    <div className="hero-art vx-home-backdrop" aria-hidden="true">
      <ReadyImage
        className="vx-home-backdrop__ambient"
        src={artworkUrl(uri, 256, 144)}
        alt=""
      />
      <ReadyImage
        className="vx-home-backdrop__art"
        src={retry ? uri : artworkUrl(uri, 1280, 720, true)}
        onError={() => {
          if (!retry) setRetry(true);
        }}
        alt=""
      />
      <span className="vx-home-backdrop__fade-bottom" />
      <span className="vx-home-backdrop__fade-left" />
    </div>
  );
}

/**
 * A card tile's image inside its `.vx-card__art` box: the Rust-chosen art
 * through the shared wsrv pipeline at the tile's size, retried once at its
 * origin before the next Rust fallback candidate. `poster` prefers the
 * poster role at poster geometry and falls back to the landscape candidates
 * (the box crops them). With nothing left to show, `missing` renders (the
 * design's missing-art block: never a stretched small image).
 */
export function TileImage({
  item,
  context,
  initial,
  poster,
  size,
  missing,
  className,
}: {
  item: MediaItem;
  context: "queue" | "catalog";
  /** Caller-computed presentation for the same item+context; recomputed only after an image failure. */
  initial?: CardPresentation;
  poster?: boolean;
  /** Derivative size requested for landscape art. */
  size: readonly [number, number];
  missing: ReactNode;
  className?: string;
}) {
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const [originalRetries, setOriginalRetries] = useState<string[]>([]);
  const [posterFailed, setPosterFailed] = useState(false);
  const [posterRetried, setPosterRetried] = useState(false);
  const posterImage = poster ? presentation(item).posterImage ?? undefined : undefined;
  const posterDerivative = useMemo(() => artworkUrl(posterImage, 300, 450), [posterImage]);
  const card =
    failedImages.length || !initial
      ? cardPresentation(item, context, failedImages)
      : initial;
  const original = card.image ?? undefined;
  const [width, height] = size;
  const derivative = useMemo(
    () => artworkUrl(original, width, height, false, card.imageRole === "logo"),
    [original, card.imageRole, width, height],
  );
  if (posterImage && posterDerivative && !posterFailed) {
    return (
      <ReadyImage
        className={className}
        src={posterRetried ? posterImage : posterDerivative}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => {
          if (!posterRetried && posterDerivative !== posterImage) setPosterRetried(true);
          else setPosterFailed(true);
        }}
      />
    );
  }
  const src = original && originalRetries.includes(original) ? original : derivative;
  if (!src) return <>{missing}</>;
  return (
    <ReadyImage
      className={className}
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => {
        if (!original) return;
        if (src !== original) setOriginalRetries(previous => previous.includes(original) ? previous : [...previous, original]);
        else setFailedImages(previous => previous.includes(original) ? previous : [...previous, original]);
      }}
    />
  );
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
