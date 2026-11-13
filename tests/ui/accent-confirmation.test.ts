import { expect, it, vi } from "vitest";
import { createPreferenceControls } from "../../src/tv-solid/remote/preference-controls";
import type { DisplayPreferences, Preferences } from "../../src/tv-solid/remote/types";
import type { ScopedRequest } from "../../src/tv-solid/remote/feature-ports";

vi.mock("../../src/tv-solid/remote/display", () => ({defaultDisplayPreferences: {accent_color: "#F5C542"}}));
const colors = ["#F5C542", "#FF8B5C", "#62D9BC", "#A3BCFF"];
const control = {id: "accent_color", label: "Accent colour", group: "display", kind: "swatches",
  choices: colors.map(value => ({label: value, value}))};
function fixture(accent: string) {
  let current: Preferences = {revision: 7, preferences: {}, controls: [control], display: {
    accent_color: accent, show_ratings: true, text_size: "default", reduce_motion: "follow", screen_saver_minutes: 5, screen_inset: 0}};
  const writes: {revision: number; display: DisplayPreferences}[] = [];
  let reject = false;
  const request: ScopedRequest = async <T>(_path: string, method = "GET", body?: unknown): Promise<T> => {
    expect(method).toBe("PUT");
    const value = body as {revision: number; display: DisplayPreferences};
    writes.push(value);
    if (reject) throw new Error("Preference write failed");
    expect(value.revision).toBe(current.revision);
    return {...current, revision: current.revision + 1, display: value.display} as T;
  };
  const reload = vi.fn(async () => {});
  const controls = createPreferenceControls({current: () => current, adopt: value => {current = value;}, request,
    path: () => "/api/profiles/fixture/preferences", reload, dialogs: {open: vi.fn(), close: vi.fn()}, calibrate: vi.fn()});
  return {row: () => controls.displayItem(control), current: () => current, writes, reload, reject: () => {reject = true;}};
}

it.each(colors)("keeps the server-saved accent when Select confirms %s", async saved => {
  const index = colors.indexOf(saved), before = colors[(index + colors.length - 1) % colors.length];
  const f = fixture(before);
  await f.row().cycle!(1);
  expect(f.current().display?.accent_color).toBe(saved);
  expect(f.writes).toHaveLength(1);
  expect(f.writes[0]).toMatchObject({revision: 7, display: {accent_color: saved, show_ratings: true, text_size: "default"}});
  await f.row().run(); await f.row().run();
  expect(f.current().display?.accent_color).toBe(saved);
  expect(f.current().revision).toBe(8);
  expect(f.writes).toHaveLength(1);
  expect(f.reload).toHaveBeenCalledOnce();
});

it("retains normal previous/next wrapping and uses each authoritative revision receipt", async () => {
  const f = fixture(colors[0]);
  await f.row().cycle!(-1);
  expect(f.current().display?.accent_color).toBe(colors[3]);
  await f.row().run();
  expect(f.current().display?.accent_color).toBe(colors[3]);
  await f.row().cycle!(1);
  expect(f.current().display?.accent_color).toBe(colors[0]);
  expect(f.writes.map(write => write.revision)).toEqual([7, 8]);
});

it("keeps the prior server value after a rejected change without retrying it on confirmation", async () => {
  const f = fixture(colors[3]); f.reject();
  await expect(f.row().cycle!(1)).rejects.toThrow("Preference write failed");
  expect(f.current().display?.accent_color).toBe(colors[3]);
  await f.row().run();
  expect(f.current().display?.accent_color).toBe(colors[3]);
  expect(f.writes).toHaveLength(1);
  expect(f.reload).not.toHaveBeenCalled();
});
