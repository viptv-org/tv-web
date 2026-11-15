import { afterEach, expect, it, vi } from "vitest";
import { createOverlayController, type OverlayFocus } from "../../src/tv-solid/remote/overlay-controller";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
function setup() {
  vi.useFakeTimers();
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => callback(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', (timer: number) => clearTimeout(timer));
  const focus: OverlayFocus = {zone: 'rows', column: 3, row: 1, choice: 0};
  const restore = vi.fn((value: OverlayFocus) => Object.assign(focus, value));
  const text = {begin: vi.fn(), clear: vi.fn()};
  const errors = {clear: vi.fn(), restore: vi.fn()};
  const control = createOverlayController({focus: {screen: () => 'home', capture: () => ({...focus}), restore,
    selection: () => focus.choice, select: index => { focus.choice = index; }}, text, errors});
  return {control, focus, restore, text};
}
it('an animated close cannot restore an origin over a newer focus', () => {
  const {control, focus, restore} = setup();
  control.open({kind: 'sources', title: 'Choose a source'});
  vi.advanceTimersByTime(16);
  control.close();
  // The drawer owns the slide: the overlay stays up until it reports.
  expect(control.current()).toBeDefined();
  focus.column = 9;
  control.reportSettled('closed');
  expect(control.current()).toBeUndefined();
  expect(focus.column).toBe(9);
  expect(restore).not.toHaveBeenCalled();
  control.dispose();
});
it('the overlay settles only when the drawer reports the slide', () => {
  const {control} = setup();
  control.open({kind: 'sources', title: 'Choose a source'});
  expect(control.settled()).toBe(false);
  vi.advanceTimersByTime(16);
  control.reportSettled('open');
  expect(control.settled()).toBe(true);
  control.dispose();
});
it('disposal retires animation/close callbacks without later UI writes', () => {
  const {control, restore, text} = setup();
  control.open({kind: 'sources', title: 'Choose a source'});
  control.close();
  control.dispose();
  expect(vi.getTimerCount()).toBe(0);
  vi.advanceTimersByTime(1000);
  control.reportSettled('closed');
  expect(restore).not.toHaveBeenCalled();
  expect(text.clear).not.toHaveBeenCalled();
});
