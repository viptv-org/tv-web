import { Rounded } from "@solidtv/renderer/webgl/shaders";

/** Renderer 1.9.4 already folds worldAlpha into each quad's vertex colors.
 * Its Rounded fragment applies u_alpha again, making translucent art and
 * entrance fades too dark. Keep its rounded geometry, but apply opacity once.
 * Scoped to this TV renderer; no dependency files or React path are patched.
 */
const fragment = Rounded.fragment;
if (typeof fragment !== "string" || !fragment.includes("gl_FragColor = color * alpha * u_alpha;"))
  throw new Error("Review the TV rounded-opacity compatibility fix after a renderer upgrade");
export const tvRoundedShader = {
  ...Rounded,
  fragment: fragment
    .replace("uniform float u_alpha;", "")
    .replace("gl_FragColor = color * alpha * u_alpha;", "gl_FragColor = color * alpha;"),
};
