import { expect, it, vi } from "vitest";

vi.mock("../src/roku/worker-task", () => ({ postRokuTask: vi.fn() }));
import { nativeKeySpec } from "../src/roku/browser-services";

it("routes Roku Star/Info to the shared source action menu", () => {
  expect(nativeKeySpec("info")).toEqual({ key: "ContextMenu", keyCode: 93 });
  expect(nativeKeySpec("options")).toEqual({ key: "ContextMenu", keyCode: 93 });
});

it("preserves ordinary selection and media keys", () => {
  expect(nativeKeySpec("select")).toEqual({ key: "Enter", keyCode: 13 });
  expect(nativeKeySpec("fwd")).toEqual({ key: "FastForward", keyCode: 417 });
});

it("preserves the native Back name and legacy key code for shared navigation", () => {
  expect(nativeKeySpec("back")).toEqual({ key: "Back", keyCode: 8 });
});
