import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TvApi, type PlaybackPreferences } from "../../src/api";
import { Settings, checkManifestUrl } from "../../src/ui/Settings";

const prefs: PlaybackPreferences = {
  audioLanguage: "",
  subtitleLanguage: "",
  subtitlesEnabled: false,
  subtitleSize: "normal",
  subtitleStyle: "system",
  quality: "auto",
  autoplay: true,
};

function fakeApi(): TvApi {
  const controller = new AbortController();
  return {
    createScope: () => ({ signal: controller.signal, abort: () => controller.abort() }),
    addons: async () => [],
  } as unknown as TvApi;
}

/** Desktop arrangement (jsdom has no phone media query): section nav + pane. */
function renderSettings(
  playbackEngine?: { choice: "auto" | "mpv" | "gstreamer"; select: (engine: "auto" | "mpv" | "gstreamer") => void },
  extra: Partial<Parameters<typeof Settings>[0]> = {},
) {
  const onSignOut = vi.fn();
  render(
    <Settings
      api={fakeApi()}
      profile="1"
      prefs={prefs}
      onPrefs={vi.fn()}
      onProfiles={vi.fn()}
      onSignOut={onSignOut}
      onError={vi.fn()}
      playbackEngine={playbackEngine}
      list
      {...extra}
    />,
  );
  return { onSignOut };
}

describe("Settings playback engine", () => {
  it("offers the engine choices in a menu, marks the current one and reports the selection", () => {
    const select = vi.fn();
    renderSettings({ choice: "auto", select });
    fireEvent.click(screen.getByRole("button", { name: "Playback preferences" }));
    fireEvent.click(screen.getByRole("button", { name: /^Playback engine/ }));

    const menu = screen.getByRole("menu", { name: "Playback engine" });
    const options = within(menu).getAllByRole("menuitemradio");
    expect(options.map((option) => option.textContent)).toEqual(["AutoCurrent", "mpv", "gstreamer"]);
    expect(options[0]).toHaveAttribute("aria-checked", "true");

    fireEvent.click(within(menu).getByRole("menuitemradio", { name: "mpv" }));
    expect(select).toHaveBeenCalledWith("mpv");
    // The menu closes once a choice is made.
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("shows the persisted choice as the row value", () => {
    renderSettings({ choice: "gstreamer", select: vi.fn() });
    fireEvent.click(screen.getByRole("button", { name: "Playback preferences" }));
    expect(screen.getByRole("button", { name: /^Playback engine.*gstreamer$/ })).toBeTruthy();
  });

  it("hides the engine row when the host has no native engine", () => {
    renderSettings(undefined);
    fireEvent.click(screen.getByRole("button", { name: "Playback preferences" }));
    expect(screen.queryByRole("button", { name: /Playback engine/ })).toBeNull();
  });
});

describe("Settings sign out and appearance", () => {
  it("asks before signing out and signs out only on confirmation", () => {
    const { onSignOut } = renderSettings();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    const dialog = screen.getByRole("dialog", { name: "Sign out of this device?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(onSignOut).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it("toggles OLED and picks an accent colour on the Appearance pane", () => {
    const toggle = vi.fn();
    renderSettings(undefined, { appearance: { oled: false, toggle } });
    fireEvent.click(screen.getByRole("switch", { name: "OLED mode" }));
    expect(toggle).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: /^Accent colour/ }));
    const menu = screen.getByRole("menu", { name: "Accent colour" });
    expect(within(menu).getAllByRole("menuitemradio").map((item) => item.textContent)).toEqual(["GoldCurrent", "Coral", "Mint", "Periwinkle"]);
    fireEvent.click(within(menu).getByRole("menuitemradio", { name: "Mint" }));
    expect(document.documentElement.getAttribute("data-accent")).toBe("mint");
    expect(localStorage.getItem("viptv:appearance:accent")).toBe("mint");
  });
});

describe("manifest URL check", () => {
  it("uses the design's install error copy", () => {
    expect(() => checkManifestUrl("not a url")).toThrow("That does not look like an addon URL.");
    expect(() => checkManifestUrl("http://addon.example/manifest.json")).toThrow("Enter an HTTPS manifest URL.");
    expect(checkManifestUrl(" https://addon.example/manifest.json ")).toBe("https://addon.example/manifest.json");
  });
});
