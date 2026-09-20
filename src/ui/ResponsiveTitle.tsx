import { useState } from "react";

/** Responsive hero title: text first, logo promoted once it decodes. */
export function ResponsiveTitle({ title, logo }: { title: string; logo?: string | null }) {
  const [loaded, setLoaded] = useState<string>();
  return <h1 className={`responsive-title ${logo && loaded === logo ? "has-logo" : ""}`}><span>{title}</span>{logo && <img src={logo} alt="" onLoad={() => setLoaded(logo)} onError={() => setLoaded(undefined)} />}</h1>;
}
