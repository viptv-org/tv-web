import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { RemoteRoot, TvButton, focusElement } from "../../src/ui/remote";
afterEach(() => vi.useRealTimers());
it("fires the secondary action after 700ms without activating again on release", () => {
  vi.useFakeTimers();
  const activate = vi.fn();
  const hold = vi.fn();
  render(
    <RemoteRoot>
      <TvButton id="resume" onActivate={activate} onHold={hold}>
        Resume
      </TvButton>
    </RemoteRoot>,
  );
  screen.getByRole("button", { name: "Resume" }).focus();
  fireEvent.keyDown(window, { key: "Enter", keyCode: 13 });
  act(() => vi.advanceTimersByTime(699));
  expect(hold).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1));
  expect(hold).toHaveBeenCalledTimes(1);
  fireEvent.keyUp(window, { key: "Enter", keyCode: 13 });
  expect(activate).not.toHaveBeenCalled();
});

it("activates a short OK press exactly once and cancels a hold when Back is pressed", () => {
  vi.useFakeTimers();
  const activate = vi.fn(),
    hold = vi.fn(),
    back = vi.fn();
  render(
    <RemoteRoot onBack={back}>
      <TvButton id="choose" onActivate={activate} onHold={hold}>
        Choose source
      </TvButton>
    </RemoteRoot>,
  );
  screen.getByRole("button").focus();
  fireEvent.keyDown(window, { key: "Enter" });
  act(() => vi.advanceTimersByTime(200));
  fireEvent.keyUp(window, { key: "Enter" });
  expect(activate).toHaveBeenCalledTimes(1);
  fireEvent.keyDown(window, { key: "Enter" });
  fireEvent.keyDown(window, { key: "Escape" });
  act(() => vi.advanceTimersByTime(1000));
  fireEvent.keyUp(window, { key: "Enter" });
  expect(back).toHaveBeenCalledTimes(1);
  expect(hold).not.toHaveBeenCalled();
  expect(activate).toHaveBeenCalledTimes(1);
});

it("leaves native text editing keys to responsive fields while Escape still goes back", () => {
  const back = vi.fn();
  render(<RemoteRoot inputMode="responsive" onBack={back}><input aria-label="Search" /></RemoteRoot>);
  const input = screen.getByRole("textbox");
  input.focus();
  for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", "Backspace"]) {
    expect(fireEvent.keyDown(input, { key })).toBe(true);
  }
  expect(fireEvent.keyDown(input, { key: "Escape" })).toBe(false);
  expect(back).toHaveBeenCalledOnce();
});


it("triggers onToggleFullscreen when Escape is pressed in responsive mode", () => {
  const back = vi.fn();
  const toggleFullscreen = vi.fn();
  render(<RemoteRoot inputMode="responsive" onBack={back} onToggleFullscreen={toggleFullscreen}><button>Test</button></RemoteRoot>);
  expect(fireEvent.keyDown(window, { key: "Escape" })).toBe(false);
  expect(toggleFullscreen).toHaveBeenCalledOnce();
  expect(back).not.toHaveBeenCalled();
});

it("keeps responsive controls pointer-first without arrival focus or TV key handling", () => {
  vi.useFakeTimers();
  const activate = vi.fn(), hold = vi.fn(), media = vi.fn();
  render(<RemoteRoot inputMode="responsive" onMediaKey={media}><div className="responsive-app">
    <TvButton id="home" onActivate={activate} onHold={hold}>Home</TvButton>
    <TvButton id="next" onActivate={activate}>Next</TvButton>
  </div></RemoteRoot>);
  const home = screen.getByRole("button", { name: "Home" });
  focusElement("home");
  expect(document.activeElement).not.toBe(home);
  home.focus();
  expect(fireEvent.keyDown(home, { key: "ArrowRight" })).toBe(true);
  expect(document.activeElement).toBe(home);
  fireEvent.keyDown(home, { key: "Enter" });
  act(() => vi.advanceTimersByTime(800));
  fireEvent.keyUp(home, { key: "Enter" });
  expect(hold).not.toHaveBeenCalled();
  expect(activate).not.toHaveBeenCalled();
  expect(media).not.toHaveBeenCalled();
  fireEvent.click(home);
  expect(activate).toHaveBeenCalledOnce();
});
