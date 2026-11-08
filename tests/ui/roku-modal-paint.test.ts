import { expect, it } from "vitest";
import { modalPaintStack } from "../../src/tv-solid/platform/modal-paint-stack";
type Node = { name: string; children: Node[] };
const node = (name = "group"): Node => ({ name, children: [] });
const insert = (parent: Node, child: Node) => { parent.children.push(child); };
const painted = (root: Node): string[] => root.children.length ? root.children.flatMap(painted) : root.name === "group" ? [] : [root.name];
it("keeps headers above a background inserted after text, and later modals above both", () => {
  const scene = node(), panel = node(); insert(scene, panel);
  const add = modalPaintStack(panel, node, insert);
  add("label", node("heading"));
  add("rect", node("late panel background"));
  add("label", node("source row"));
  const error = node(); insert(scene, error);
  const addError = modalPaintStack(error, node, insert);
  addError("label", node("error text")); addError("rect", node("error background"));
  expect(painted(scene)).toEqual(["late panel background", "heading", "source row", "error background", "error text"]);
});
