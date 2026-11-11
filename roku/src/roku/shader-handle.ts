import type { RokuNode } from './node';

/** Renderer shader handle. Mutable props are proxied so Effects re-apply. */
export class ShaderHandle {
  shaderType: string;
  name: string;
  props: any;
  nodes = new Set<RokuNode>();
  destroyed = false;
  constructor(name: string, props: any) {
    this.name = name;
    this.shaderType = name;
    const raw = props || {};
    this.props = new Proxy(raw, {
      set: (target: any, key: string, value: any) => {
        target[key] = value;
        this.nodes.forEach(node => node.effectDirty());
        return true;
      },
      deleteProperty: (target: any, key: string) => {
        delete target[key];
        this.nodes.forEach(node => node.effectDirty());
        return true;
      }
    });
  }
  destroy() {
    this.destroyed = true;
    this.nodes.clear();
  }
}
