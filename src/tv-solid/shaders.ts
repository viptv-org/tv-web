import type { RendererMain, ShaderType } from "@solidtv/renderer";

/**
 * Renderer 2.0 keeps no name on a shader instance, only its type. The focus
 * debug scene dump needs the name the app registered, so registrations go
 * through here: the type is recorded once and every instance of it resolves.
 */
const names = new WeakMap<object, string>();

export function registerTvShader(
  renderer: RendererMain,
  name: string,
  type: ShaderType<any>,
): void {
  renderer.registerShaderType(name, type);
  names.set(type as object, name);
}

/**
 * The 1.x batch predicate: two ops batch when they share a shader instance.
 * Renderer 2.0 types the arguments as plain objects, so read `props` through
 * the shape every node handle has.
 */
export function sameShader(node: object, op: object): boolean {
  return (
    (node as { props: { shader: unknown } }).props.shader ===
    (op as { props: { shader: unknown } }).props.shader
  );
}

export function tvShaderName(
  shader: { shaderType?: object } | null | undefined,
): string | undefined {
  const type = shader?.shaderType;
  return type === undefined ? undefined : names.get(type);
}
