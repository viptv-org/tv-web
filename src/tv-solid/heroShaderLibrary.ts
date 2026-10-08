/** GLSL ES 1.00 sources for the TV-042 hero backdrop, bundled verbatim from the
 * hash-pinned design snapshot (`design-contract/assets/hero`). Program
 * assembly follows that directory's README; this module never edits a shader.
 * It is only reachable through the lazily imported renderer chunk. */
import catalog from "../../design-contract/assets/hero/index.json";
import type { HeroTransitionSpec } from "./heroMotionPolicy";

const sources = import.meta.glob("../../design-contract/assets/hero/**/*.glsl", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const PREFIX = "../../design-contract/assets/hero/";

function source(path: string): string {
  const text = sources[`${PREFIX}${path}.glsl`];
  if (typeof text !== "string") throw new Error(`Missing hero shader ${path}`);
  return text;
}

export const HERO_VERTEX =
  "attribute vec2 aPos;\nvarying vec2 vUv;\n" +
  "void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }";
export const HERO_TRANSITION_MAIN =
  "void main() { gl_FragColor = vec4(transition(vUv, uProgress).rgb, 1.0); }";

export interface HeroShaderIndex {
  readonly transitions: readonly HeroTransitionSpec[];
  readonly edges: readonly { readonly id: string; readonly name: string }[];
}

export const heroShaderIndex: HeroShaderIndex = catalog;
export const heroEdgeIds: readonly string[] = catalog.edges.map(edge => edge.id);

export function transitionSource(id: string): string {
  return `${source("transition_common")}\n${source(`transitions/${id}`)}\n${HERO_TRANSITION_MAIN}`;
}

export function edgeSource(id: string): string {
  return `${source("edge_common")}\n${source(`edges/${id}`)}\n${source("edge_main")}`;
}

export function ambientSource(): string {
  return `${source("edge_common")}\n${source("ambient_main")}`;
}
