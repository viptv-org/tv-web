import { normalizeCore } from "../core";
import { useState, type ImgHTMLAttributes, type ReactNode } from "react";

/** Same public-host allowlist as Roku ImagePolicy: opaque/provider URLs stay at origin. */
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
}: {
  src?: string;
  fallback: ReactNode;
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
        onLoad={() => setLoaded(src)}
        onError={() => setLoaded(undefined)}
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
