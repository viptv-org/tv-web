import { useState, type ImgHTMLAttributes, type ReactNode } from "react";

/** Same public-host allowlist as Roku ImagePolicy: opaque/provider URLs stay at origin. */
export function artworkUrl(
  original: string | undefined,
  width: number,
  height: number,
  large = false,
  logo = false,
) {
  if (!original) return undefined;
  let uri = original;
  try {
    if (uri.startsWith("https://wsrv.nl/?"))
      uri = new URL(uri).searchParams.get("url") || uri;
    if (
      !/^https:\/\/(image\.tmdb\.org|artworks\.thetvdb\.com|episodes\.metahub\.space|images\.metahub\.space|live\.metahub\.space|assets\.fanart\.tv|i\.imgur\.com)\/[^?#@]+$/.test(
        uri,
      )
    )
      return original;
    uri = uri.replace(
      /^https:\/\/image\.tmdb\.org\/t\/p\/(w[0-9]+|original)\//,
      `https://image.tmdb.org/t/p/${width > 1280 ? "original" : width > 500 ? "w1280" : "w500"}/`,
    );
    return `https://wsrv.nl/?url=${encodeURIComponent(uri)}&w=${width}&h=${height}&fit=${logo ? "inside" : "cover"}&output=${logo ? "png" : "jpg"}&q=${large ? 95 : 85}&we`;
  } catch {
    return original;
  }
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
