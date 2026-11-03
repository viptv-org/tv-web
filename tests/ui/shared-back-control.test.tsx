import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BackControl, type BackPlacement } from "../../src/ui/primitives/Back";

const slots: readonly BackPlacement[] = ["page", "over-art", "player", "titlebar"];

describe("the one Back control", () => {
  it("renders the contract's placement for every surface it serves", () => {
    for (const placement of slots) {
      const { unmount } = render(
        <BackControl placement={placement} onActivate={() => undefined} />,
      );
      const control = screen.getByRole("button", { name: "Back" });
      expect(control.className).toContain("vx-back");
      expect(control.className).toContain(`vx-back--${placement}`);
      unmount();
    }
  });

  it("keeps the accessible name a Settings sub-page asks for", () => {
    render(<BackControl label="Back to Settings" onActivate={() => undefined} />);
    expect(screen.getByRole("button", { name: "Back to Settings" })).toBeTruthy();
  });

  it("keeps the focus hooks existing remote and e2e specs select on", () => {
    render(<BackControl id="player-back" placement="player" onActivate={() => undefined} />);
    expect(document.querySelector('[data-focus-id="player-back"]')).toBeTruthy();
  });

  it("leaves the destination with the surface that owns it", () => {
    const onActivate = vi.fn();
    render(<BackControl onActivate={onActivate} />);
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it("keeps the title bar's Back out of the tab order", () => {
    render(<BackControl placement="titlebar" onActivate={() => undefined} />);
    expect(screen.getByRole("button", { name: "Back" }).tabIndex).toBe(-1);
  });
});