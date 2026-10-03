import { useEffect, useState } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { expect, it, vi } from "vitest";
import {
  TauriNativeAdapter,
  type NativeVideoSnapshot,
  type PlayerSnapshot,
} from "@viptv/video";
import { PlayerScreen } from "../../src/screens/PlayerScreen";
it("renders native time, pause/resume, immediate volume feedback and picture controls", async () => {
  const anchor = document.createElement("video");
  document.body.append(anchor);
  let wire: NativeVideoSnapshot = {
    durationSeconds: 120,
    currentTimeSeconds: 30,
    bufferedSeconds: 60,
    live: false,
    seekable: true,
    seekableStartSeconds: 0,
    seekableEndSeconds: 120,
    playing: true,
    videoWidth: 640,
    videoHeight: 360,
    tracks: [],
    backend: "gstreamer",
    presentedFrames: 30,
    droppedFrames: 0,
    measuredFps: 25,
    hardwareBackend: "test",
  };
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const controls: string[] = [];
  const player = new TauriNativeAdapter(
    anchor,
    {
      async invoke<T>(
        command: string,
        args?: Record<string, unknown>,
      ): Promise<T> {
        if (command.endsWith("native_diagnostics"))
          return {
            protocolVersion: 1,
            crateName: "tauri-plugin-video",
            crateVersion: "0.4.0",
            platform: "linux",
            engines: ["gstreamer"],
          } as T;
        if (command.endsWith("native_control")) {
          const p = args?.payload as { action: string };
          controls.push(p.action);
          if (p.action === "volume") await pending;
          if (p.action === "pause") wire = { ...wire, playing: false };
          if (p.action === "play") wire = { ...wire, playing: true };
        }
        return wire as T;
      },
    },
    { platform: "linux", engine: "gstreamer" },
  );
  await player.open({
    url: "https://fixture.invalid/movie.mp4",
    kind: "vod",
    adoptEngineDuration: true,
  });
  function Controls() {
    const [snapshot, setSnapshot] = useState<PlayerSnapshot>(player.snapshot);
    useEffect(() => player.subscribe(setSnapshot), []);
    const [mode, setMode] = useState<"fit" | "fill">("fit");
    useEffect(() => {
      void player.setPictureMode(mode);
    }, [mode]);
    const [info, setInfo] = useState(false);
    return (
      <PlayerScreen
        responsive
        overlay
        dialogOpen={false}
        selected={{ id: "fixture", type: "movie", name: "Native controls", title: "Native controls", episodes: [], genres: [], raw: {} }}
        busy={false}
        snapshot={snapshot}
        playerNotice={undefined}
        seek={undefined}
        seekPending={false}
        setSeek={vi.fn()}
        setOverlay={vi.fn()}
        commitSeek={(seconds) => player.seek(seconds)}
        togglePlayback={() =>
          void (snapshot.state === "paused" ? player.play() : player.pause())
        }
        toggleLiveMute={vi.fn()}
        fullscreenControl={
          { fullscreen: false, toggle: async () => {} } as Parameters<
            typeof PlayerScreen
          >[0]["fullscreenControl"]
        }
        pictureMode={mode}
        setPictureMode={setMode}
        player={{ current: player }}
        fail={vi.fn()}
        nextEpisode={vi.fn()}
        stop={() => player.stop()}
        trackChoices={vi.fn()}
        activeTrackPopup={null}
        setActiveTrackPopup={vi.fn()}
        playerInfoOpen={info}
        setPlayerInfoOpen={setInfo}
        audioTrackList={[]}
        textTrackList={[]}
        subtitleOffOption={{ selected: true, onSelect: vi.fn() }}
        playerInfoRows={[
          { label: "Engine", value: "tauri-native (gstreamer)" },
        ]}
        readBufferedRanges={() => null}
        lastControlActivity={{ current: 0 }}
        setControlActivity={vi.fn()}
        upNext={undefined}
        playUpNext={vi.fn()}
        cancelUpNext={vi.fn()}
      />
    );
  }
  const view = render(<Controls />);
  try {
    expect(screen.getByText("0:30")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Play" })).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy(),
    );
    const volume = screen.getByRole("slider", {
      name: "Volume",
    }) as HTMLInputElement;
    for (let index = 1; index <= 25; index++) {
      fireEvent.change(volume, { target: { value: String(index / 100) } });
    }
    fireEvent.change(volume, { target: { value: "0.37" } });
    expect(volume.value).toBe("0.37");
    expect(volume.parentElement?.querySelector<HTMLElement>(".vx-player__slider-knob")?.style.left).toBe("37%");
    expect(controls.filter(action => action === "volume")).toHaveLength(1);
    await act(async () => {
      release();
      await pending;
    });
    await waitFor(() => expect(controls.filter(action => action === "volume")).toHaveLength(2));
    fireEvent.click(screen.getByRole("button", { name: "Fill video" }));
    await waitFor(() => expect(controls).toContain("crop"));
    expect(screen.getByRole("button", { name: "Fit video" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Playback info" }));
    expect(screen.getByText("tauri-native (gstreamer)")).toBeTruthy();
  } finally {
    release();
    view.unmount();
    await player.stop();
    anchor.remove();
  }
});
