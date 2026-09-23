import { useState } from "react";

/**
 * Logos that have already decoded in this session. A remounted title (Back
 * to Home, say) promotes a known logo on its first render: a text-first
 * frame would be shorter than the logo and clamp the restored page offset.
 */
const decodedLogos = new Set<string>();
const DECODED_LIMIT = 64;

/** Responsive hero title: text first, logo promoted once it decodes. */
export function ResponsiveTitle({ title, logo }: { title: string; logo?: string | null }) {
  const [loaded, setLoaded] = useState<string>();
  const shown = !!logo && (loaded === logo || decodedLogos.has(logo));
  return <h1 className={`responsive-title ${shown ? "has-logo" : ""}`}><span>{title}</span>{logo && <img src={logo} alt="" onLoad={() => {
    if (decodedLogos.size >= DECODED_LIMIT) decodedLogos.delete(decodedLogos.values().next().value as string);
    decodedLogos.add(logo);
    setLoaded(logo);
  }} onError={() => {
    decodedLogos.delete(logo);
    setLoaded(undefined);
  }} />}</h1>;
}
