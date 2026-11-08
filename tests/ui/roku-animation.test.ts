import { expect, it } from "vitest";
import { Animator, resolveEasing } from "../../roku/src/roku/animation";

it("honors the shared CSS timing function instead of silently using linear motion", () => {
  const ease = resolveEasing("cubic-bezier(.2,0,0,1)");
  expect(ease(0)).toBe(0);
  expect(ease(1)).toBe(1);
  expect(ease(0.5)).toBeGreaterThan(0.8);
  expect(resolveEasing("cubic-bezier(.2,0,0,1)")).toBe(ease);
  const node = { y: 0, requestRender() {} }, animator = new Animator();
  const motion = animator.create(node, { y: 100 }, { duration: 450, timingFunction: "cubic-bezier(.2,0,0,1)" }, () => {});
  motion.start(); animator.tick(225);
  expect(node.y).toBeGreaterThan(80);
  animator.tick(225);
  expect(node.y).toBe(100);
});
