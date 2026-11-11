type PaintNode = { parentNode?: PaintNode | null; children?: PaintNode[] };

export function nativePaintOrder(a: PaintNode, b: PaintNode): number {
  if (a === b) return 0;
  const left: PaintNode[] = [], right: PaintNode[] = [];
  for (let node: PaintNode | null | undefined = a; node; node = node.parentNode) left.push(node);
  for (let node: PaintNode | null | undefined = b; node; node = node.parentNode) right.push(node);
  let i = left.length - 1, j = right.length - 1;
  while (i >= 0 && j >= 0 && left[i] === right[j]) { i--; j--; }
  if (i < 0) return -1;
  if (j < 0) return 1;
  const siblings = left[i].parentNode?.children;
  if (!siblings || left[i].parentNode !== right[j].parentNode) return 0;
  return siblings.indexOf(left[i]) - siblings.indexOf(right[j]);
}
