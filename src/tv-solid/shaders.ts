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

export function tvShaderName(
  shader: { shaderType?: object } | null | undefined,
): string | undefined {
  const type = shader?.shaderType;
  return type === undefined ? undefined : names.get(type);
}
