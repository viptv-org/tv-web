/** Keep modal text above late-created backgrounds inside a shared motion group. */
export function modalPaintStack<Node>(
  parent: Node,
  createGroup: () => Node,
  insert: (parent: Node, child: Node) => void,
) {
  const visuals = createGroup(), labels = createGroup();
  insert(parent, visuals);
  insert(parent, labels);
  return (kind: string, child: Node) => insert(kind === "label" ? labels : visuals, child);
}
