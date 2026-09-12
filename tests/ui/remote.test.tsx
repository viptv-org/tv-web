import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { RemoteRoot, TvButton } from "../../src/ui/remote";
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
