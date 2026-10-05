import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { AppDialogs } from "../../src/ui/app/AppDialogs";
import type { AppApi } from "../../src/ui/app/useTvApp";
import { NativeSurfaceCompositor } from "../../vendor/video/src/tauri-native/native-surface-compositor";
it("keeps an actual playback error toast visible during native aperture refresh", () => {
  const video = document.createElement("video");
  document.body.append(video);
  const app = {
    screen: "player",
    responsive: true,
    busy: false,
    preparing: false,
    bootingHome: false,
    items: [],
    profiles: [],
    error: "Track unavailable",
    setError: vi.fn(),
    setStartupAttempt: vi.fn(),
  } as unknown as AppApi;
  const rendered = render(<AppDialogs app={app} />);
  const toast = screen.getByRole("alert");
  const region = toast.closest<HTMLElement>(".vx-toast-region")!;
  vi.spyOn(region, "getBoundingClientRect").mockReturnValue(
    new DOMRect(20, 20, 300, 80),
  );
  const compositor = new NativeSurfaceCompositor("feedback-case", video);
  try {
    for (let n = 0; n < 3; n++) {
      compositor.refresh();
      compositor.commit(
        compositor.measure({ x: 0, y: 0, width: 640, height: 360 }, 1),
      );
    }
    expect(toast.textContent).toContain("Track unavailable");
    expect(region.hasAttribute("data-tauri-native-video-occluder")).toBe(false);
    expect(
      region.style.getPropertyValue("--tauri-native-video-mask-image"),
    ).toBe("");
  } finally {
    compositor.release();
    rendered.unmount();
    video.remove();
  }
});
