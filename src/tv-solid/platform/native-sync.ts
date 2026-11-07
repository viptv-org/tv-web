type NativeNode = {
  parentNode?: NativeNode | null;
  children?: NativeNode[];
  alpha?: number;
  destroyed?: boolean;
  detachedVisualHolder?: boolean;
  nativeMotionRoot?: boolean;
};

export function motionRoot(node: NativeNode): NativeNode | undefined {
  let root: NativeNode | undefined;
  let current: NativeNode | null | undefined = node;
  while (current) {
    if (current.nativeMotionRoot) root = current;
    current = current.parentNode;
  }
  return root;
}

export function opacityWithin(node: NativeNode, root: NativeNode): number {
  let alpha = 1;
  let current: NativeNode | null | undefined = node;
  while (current && current !== root) {
    const own = Number(current.alpha);
    if (Number.isFinite(own)) alpha *= own;
    current = current.parentNode;
  }
  return Math.max(0, Math.min(1, alpha));
}

export class NativeSync {
  private records = new Map<NativeNode, (inheritedAlpha: number) => void>();
  private roots = new Set<NativeNode>();
  private shallow = new Set<NativeNode>();
  private stack: NativeNode[] = [];
  private visited = new Set<NativeNode>();

  constructor(private now: () => number) {}

  register(node: NativeNode, sync: (inheritedAlpha: number) => void) {
    this.records.set(node, sync);
    this.mark(node);
  }

  remove(node: NativeNode) {
    this.records.delete(node);
    this.roots.delete(node);
    this.shallow.delete(node);
  }

  mark(node: NativeNode) {
    if (node && !node.detachedVisualHolder) this.roots.add(node);
  }

  markShallow(node: NativeNode) {
    if (node && !node.detachedVisualHolder) this.shallow.add(node);
  }

  get pending() {
    return this.shallow.size > 0 || this.stack.length > 0 || this.roots.size > 0;
  }

  flush(deadline: number) {
    const alphas = new Map<NativeNode, number>();
    const alpha = (node?: NativeNode | null): number => {
      if (!node) return 1;
      const cached = alphas.get(node);
      if (cached !== undefined) return cached;
      const own = Number(node.alpha);
      const value = alpha(node.parentNode) * (Number.isFinite(own) ? own : 1);
      alphas.set(node, value);
      return value;
    };
    while (this.pending && this.now() < deadline) {
      if (this.shallow.size) {
        const node = this.shallow.values().next().value!;
        this.shallow.delete(node);
        if (!node.destroyed) this.records.get(node)?.(Math.max(0, Math.min(1, alpha(node.parentNode))));
        continue;
      }
      if (!this.stack.length) {
        for (const root of this.roots) {
          let parent = root.parentNode;
          while (parent && !this.roots.has(parent)) parent = parent.parentNode;
          if (!parent) this.stack.push(root);
        }
        this.roots.clear();
        this.visited.clear();
      }
      const node = this.stack.pop()!;
      if (!node || node.destroyed || this.visited.has(node)) continue;
      this.visited.add(node);
      try {
        this.records.get(node)?.(Math.max(0, Math.min(1, alpha(node.parentNode))));
      } catch {
        // Native nodes can retire between their layout and synchronization.
      }
      const children = node.children;
      if (children) for (let i = children.length - 1; i >= 0; i--) this.stack.push(children[i]);
    }
    return this.pending;
  }
}
