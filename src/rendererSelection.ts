/** Public TV URLs select SolidTV; desktop/web retain React. No implicit legacy fallback. */
export function selectRenderer(search: string, native: boolean): "solid" | "react" {
  const params = new URLSearchParams(search);
  if (native || params.get("renderer") === "react") return "react";
  return ["vizio", "tizen", "webos"].includes(params.get("platform") ?? "") || params.get("layout") === "tv" ? "solid" : "react";
}
