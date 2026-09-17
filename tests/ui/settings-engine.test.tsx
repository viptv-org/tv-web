import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TvApi, type PlaybackPreferences } from "../../src/api";
import { Settings } from "../../src/ui/Settings";

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

function renderSettings(
  playbackEngine?: { choice: "auto" | "mpv" | "gstreamer"; select: (engine: "auto" | "mpv" | "gstreamer") => void },
) {
  const onModal = vi.fn();
  render(
    <Settings
      api={fakeApi()}
      profile="1"
      prefs={prefs}
      onPrefs={vi.fn()}
      onProfiles={vi.fn()}
      onSignOut={vi.fn()}
      onError={vi.fn()}
      onModal={onModal}
      playbackEngine={playbackEngine}
    />,
  );
  return { onModal };
}

describe("Settings playback engine", () => {
  it("offers the engine choices through the modal and reports the selection", () => {
    const select = vi.fn();
    const { onModal } = renderSettings({ choice: "auto", select });

    fireEvent.click(screen.getByRole("button", { name: "Playback engine: Auto" }));

    expect(onModal).toHaveBeenCalledTimes(1);
    const [title, choices] = onModal.mock.calls[0] as [string, Array<{ label: string; action: () => void }>];
    expect(title).toBe("Playback engine");
    expect(choices.map((choice) => choice.label)).toEqual(["Auto", "mpv", "gstreamer"]);

    choices.find((choice) => choice.label === "mpv")!.action();
    expect(select).toHaveBeenCalledWith("mpv");
    // The modal closes once a choice is made.
    expect(onModal).toHaveBeenCalledWith("", []);
  });

  it("shows the persisted choice in the row label", () => {
    const { onModal } = renderSettings({ choice: "gstreamer", select: vi.fn() });

    expect(screen.getByRole("button", { name: "Playback engine: gstreamer" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Playback engine: gstreamer" }));
    expect(onModal).toHaveBeenCalledTimes(1);
  });

  it("hides the engine row when the host has no native engine", () => {
    renderSettings(undefined);
    expect(screen.queryByRole("button", { name: /Playback engine/ })).toBeNull();
  });
});
