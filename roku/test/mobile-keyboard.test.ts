import { afterAll, afterEach, expect, it, vi } from "vitest";
vi.mock("../src/roku/worker-task", () => ({ postRokuTask: vi.fn() }));
import { dispatchNativeKey, installBrowserServices } from "../src/roku/browser-services";
import { createTextInput } from "../../src/tv-solid/remote/input/text";
import type { Overlay, Screen } from "../../src/tv-solid/remote/app-types";

vi.stubGlobal("navigator", undefined);
installBrowserServices();
afterAll(() => vi.unstubAllGlobals());
const disposers: (() => void)[] = [];
afterEach(() => disposers.splice(0).forEach(dispose => dispose()));

function fixture() {
  let query = "", text = "", screen: Screen = "search", zone = "keyboard", overlay: Overlay | undefined;
  const done = vi.fn();
  const input = createTextInput({screen: () => screen, overlay: () => overlay, zone: () => zone,
    text: value => text = typeof value === "function" ? value(text) : value,
    query: () => query, search: value => { query = value; }, done});
  const target = globalThis as any;
  target.addEventListener("viptvtextinput", input);
  disposers.push(() => target.removeEventListener("viptvtextinput", input));
  const key = (value: string) => { dispatchNativeKey(value, true); dispatchNativeKey(value, false); };
  return {key, done, query: () => query, text: () => text,
    screen: (value: Screen) => {screen = value;}, zone: (value: string) => {zone = value;},
    overlay: (value: Overlay | undefined) => {overlay = value;}};
}

it("inserts native phone literal keys once, preserving case, spaces, percent and Unicode", () => {
  const f = fixture();
  for (const key of ["Lit_A", "Lit_ ", "Lit_%", "Lit_é", "Lit_🦊"]) f.key(key);
  expect(f.query()).toBe("A %é🦊");
  f.key("backspace"); expect(f.query()).toBe("A %é");
  f.key("enter"); expect(f.done).toHaveBeenCalledOnce();
  f.key("OK"); expect(f.done).toHaveBeenCalledOnce();
});

it("scopes native text and deletion to the active text target without swallowing app Back", () => {
  const f = fixture();
  f.screen("home"); expect(dispatchNativeKey("Lit_a", true)).toBe(false); dispatchNativeKey("Lit_a", false);
  f.screen("search"); f.zone("content"); f.key("Lit_b"); expect(f.query()).toBe("");
  f.zone("keyboard"); f.key("Lit_c"); expect(f.query()).toBe("c");
  expect(dispatchNativeKey("back", true)).toBe(false); dispatchNativeKey("back", false);
  expect(f.query()).toBe("c");
  f.overlay({kind: "text", numeric: true} as Overlay);
  f.key("Lit_x"); f.key("Lit_123456789"); expect(f.text()).toBe("12345678");
  f.key("backspace"); expect(f.text()).toBe("1234567"); expect(f.query()).toBe("c");
  f.overlay({kind: "choices"} as Overlay); f.key("Lit_d"); expect(f.query()).toBe("c");
});
