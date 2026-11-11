import { expect, it, vi } from "vitest";
import { ArtworkGate, type ArtworkRequest } from "../../src/tv-solid/platform/artwork-gate";

function setup() {
  const show=vi.fn();let pending: ArtworkRequest<string> | undefined;
  const gate=new ArtworkGate<string>(show, value => {pending=value;});
  return {gate,show,pending:() => pending!};
}

it("publishes the backdrop and logo together after both have decoded", () => {
  const {gate,show,pending}=setup();gate.request("profile","a","first",["background","logo"]);
  show.mockClear();const id=pending().id;
  gate.settled(id,"background");expect(show).not.toHaveBeenCalled();
  gate.settled(id,"logo");expect(show).toHaveBeenCalledWith("first",new Set());
});
it("keeps the current presentation and fences superseded artwork callbacks", () => {
  const {gate,show,pending}=setup();gate.request("profile","a","first",[]);
  gate.request("profile","b","skipped",["logo"]);const retired=pending().id;
  gate.request("profile","c","latest",["logo"]);show.mockClear();
  gate.settled(retired,"logo");expect(show).not.toHaveBeenCalled();
  gate.settled(pending().id,"logo");expect(show).toHaveBeenCalledWith("latest",new Set());
});
it("updates pending metadata without restarting the artwork request", () => {
  const {gate,show,pending}=setup();gate.request("profile","a","summary",["logo"]);const id=pending().id;
  gate.request("profile","a","description",["logo"]);expect(pending().id).toBe(id);expect(pending().value).toBe("description");
  gate.settled(id,"logo");expect(show).toHaveBeenLastCalledWith("description",new Set());
});
it("settles actual failures once and keeps their fallback on refresh", () => {
  const {gate,show,pending}=setup();gate.request("profile","a","first",["background","logo"]);const id=pending().id;
  gate.settled(id,"background");gate.settled(id,"logo",true);
  expect(show).toHaveBeenLastCalledWith("first",new Set(["logo"]));show.mockClear();
  gate.settled(id,"logo");expect(show).not.toHaveBeenCalled();
  gate.request("profile","a","updated",["background","logo"]);
  expect(show).toHaveBeenLastCalledWith("updated",new Set(["logo"]));
});
it("keeps waiting artwork eligible for valid completion after a deadline", () => {
  const {gate,show,pending}=setup();gate.request("profile","a","first",["background","logo"]);
  const id=pending().id;show.mockClear();
  gate.finish(id);expect(show).not.toHaveBeenCalled();expect(pending().id).toBe(id);
  gate.settled(id,"background");expect(show).not.toHaveBeenCalled();
  gate.settled(id,"logo");expect(show).toHaveBeenLastCalledWith("first",new Set());
});
it("clears another profile's presentation and invalidates its pending loads", () => {
  const {gate,show,pending}=setup();gate.request("one","a","old",["logo"]);const old=pending().id;
  gate.request("two","a","private",["logo"]);show.mockClear();
  gate.settled(old,"logo");expect(show).not.toHaveBeenCalled();
  gate.settled(pending().id,"logo");expect(show).toHaveBeenCalledWith("private",new Set());
});
it("returning to the displayed card cancels a pending replacement immediately", () => {
  const {gate,show,pending}=setup();gate.request("profile","a","first",[]);
  gate.request("profile","b","second",["logo"]);const old=pending().id;
  gate.request("profile","a","first updated",["logo"]);show.mockClear();
  gate.settled(old,"logo");expect(show).not.toHaveBeenCalled();
});

it("holds the painted frame while a row selection settles and rejects its abandoned incoming image", () => {
  const {gate,show,pending}=setup();gate.request("profile","a","painted",[]);
  gate.request("profile","b","unseen featured",["background"]);const old=pending().id;
  show.mockClear();gate.hold("profile");gate.settled(old,"background");
  expect(show).not.toHaveBeenCalled();
  gate.request("profile","c","row target",["background"]);gate.settled(pending().id,"background");
  expect(show).toHaveBeenCalledWith("row target",new Set());
});
