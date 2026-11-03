import { webcrypto } from "node:crypto";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { CastController } from "../../src/ui/CastController";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
const nativeInvoke = vi.mocked(invoke);
const complete = (result: Record<string, unknown> = {}) => JSON.stringify({ kind: "complete", result, credentialChanged: false });
const authentication = JSON.stringify({ kind: "error", error: { kind: "authentication", message: "TV requires pairing" } });
const transportFailure = JSON.stringify({ kind: "error", error: { kind: "transport", message: "SmartCast transport failed", retryable: true, protocolStatus: null } });
const discoveredTvs = JSON.stringify([
  { name: "VIZIO SmartCast (192.168.1.50)", host: "192.168.1.50" },
  { name: "Vizio TV (192.168.1.61)", host: "192.168.1.61" },
]);

function native() { Object.defineProperty(window, "__TAURI_INTERNALS__", { value: {}, configurable: true }); }
function enterAddress() {
  fireEvent.click(screen.getByRole("button", { name: "Enter IP address manually" }));
  fireEvent.change(screen.getByLabelText("TV IP address"), { target: { value: "192.168.1.50" } });
  fireEvent.click(screen.getByRole("button", { name: "Connect" }));
}
function pairingBoundary(discovery = "[]") {
  nativeInvoke.mockImplementation(async (command, args) => {
    if (command === "smartcast_discover") return discovery;
    if (command === "smartcast_configure") return undefined;
    if (command !== "smartcast_run") return undefined;
    switch ((args as Record<string, unknown> | undefined)?.operation) {
      case "pingAuth": return authentication;
      case "beginPair": return complete({ challengeType: 1, token: 42 });
      case "finishPair": return complete({ paired: true });
      default: return complete();
    }
  });
}

beforeEach(() => { nativeInvoke.mockReset(); vi.stubGlobal("crypto", webcrypto); });
afterEach(() => { Reflect.deleteProperty(window, "__TAURI_INTERNALS__"); vi.unstubAllGlobals(); });

describe("native SmartCast controller boundary", () => {
  it("keeps browser handoff truthful without issuing native commands", () => {
    render(<CastController onClose={() => {}} />);
    expect(screen.getByText(/This browser cannot pair with or control your TV/)).toBeVisible();
    expect(screen.queryByLabelText("TV IP address")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enter IP address manually" })).not.toBeInTheDocument();
    expect(nativeInvoke).not.toHaveBeenCalled();
  });

  it("lists discovered TVs as one-click connect buttons without typing an address", async () => {
    native(); pairingBoundary(discoveredTvs);
    render(<CastController onClose={() => {}} />);
    const livingRoom = await screen.findByRole("button", { name: "VIZIO SmartCast (192.168.1.50)" });
    expect(screen.getByRole("button", { name: "Vizio TV (192.168.1.61)" })).toBeVisible();
    expect(screen.queryByLabelText("TV IP address")).not.toBeInTheDocument();
    fireEvent.click(livingRoom);
    await screen.findByText("Enter the PIN displayed on your TV.");
    expect(nativeInvoke).toHaveBeenCalledWith("smartcast_configure", {
      host: "192.168.1.50", deviceId: "viptv-desktop", deviceName: "VIPTV desktop", credentialId: expect.stringMatching(/^tv-[a-f0-9]{64}$/),
    });
    expect(nativeInvoke).toHaveBeenCalledWith("smartcast_run", { operation: "pingAuth", input: "{}" });
    expect(nativeInvoke).toHaveBeenCalledWith("smartcast_run", { operation: "beginPair", input: "{}" });
  });

  it("reports searching, then a manual fallback note when discovery finds nothing", async () => {
    native();
    let finishDiscovery: ((value: string) => void) | undefined;
    nativeInvoke.mockImplementation(command => command === "smartcast_discover"
      ? new Promise<string>(resolve => { finishDiscovery = resolve; })
      : Promise.resolve(undefined));
    render(<CastController onClose={() => {}} />);
    expect(screen.getByText("Searching for TVs…")).toBeVisible();
    expect(screen.getByRole("button", { name: "Enter IP address manually" })).toBeVisible();
    await act(async () => { finishDiscovery?.("[]"); });
    expect(await screen.findByText("No Vizio TVs were found on this network. Enter the IP address manually.")).toBeVisible();
  });

  it("keeps manual IP entry as an explicit fallback alongside discovery", async () => {
    native(); pairingBoundary(discoveredTvs);
    render(<CastController onClose={() => {}} />);
    await screen.findByRole("button", { name: "VIZIO SmartCast (192.168.1.50)" });
    expect(screen.queryByLabelText("TV IP address")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enter IP address manually" }));
    expect(screen.getByLabelText("TV IP address")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enter IP address manually" }));
    expect(screen.queryByLabelText("TV IP address")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enter IP address manually" }));
    fireEvent.change(screen.getByLabelText("TV IP address"), { target: { value: "192.168.1.99" } });
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    await screen.findByText("Enter the PIN displayed on your TV.");
    expect(nativeInvoke).toHaveBeenCalledWith("smartcast_configure", {
      host: "192.168.1.99", deviceId: "viptv-desktop", deviceName: "VIPTV desktop", credentialId: expect.stringMatching(/^tv-[a-f0-9]{64}$/),
    });
  });

  it("configures native transport, pairs the TV challenge and launches only the supplied receiver", async () => {
    native(); pairingBoundary();
    const receiverUrl = "https://receiver.example/tv/?platform=vizio";
    render(<CastController receiverUrl={receiverUrl} onClose={() => {}} />);
    enterAddress();
    const pin = await screen.findByLabelText("PIN shown on your TV");
    expect(nativeInvoke).toHaveBeenCalledWith("smartcast_configure", {
      host: "192.168.1.50", deviceId: "viptv-desktop", deviceName: "VIPTV desktop", credentialId: expect.stringMatching(/^tv-[a-f0-9]{64}$/),
    });
    expect(nativeInvoke).toHaveBeenCalledWith("smartcast_run", { operation: "pingAuth", input: "{}" });
    expect(nativeInvoke).toHaveBeenCalledWith("smartcast_run", { operation: "beginPair", input: "{}" });
    fireEvent.change(pin, { target: { value: "1234" } });
    fireEvent.click(screen.getByRole("button", { name: "Pair TV" }));
    await screen.findByText("Paired with your TV.");
    expect(nativeInvoke).toHaveBeenCalledWith("smartcast_run", { operation: "finishPair", input: JSON.stringify({ challengeType: 1, token: 42, pin: "1234" }) });
    fireEvent.click(screen.getByRole("button", { name: "Open VIPTV on TV" }));
    await screen.findByText(/TV accepted the launch request/);
    expect(nativeInvoke).toHaveBeenCalledWith("smartcast_run", { operation: "launchConjure", input: JSON.stringify({ url: receiverUrl }) });
    fireEvent.click(screen.getByRole("button", { name: "Volume down" }));
    await waitFor(() => expect(nativeInvoke).toHaveBeenCalledWith("smartcast_run", { operation: "key", input: '{"key":"VOL_DOWN"}' }));
    await waitFor(() => expect(screen.getByRole("button", {name:"Mute"})).toBeEnabled());
    fireEvent.click(screen.getByRole("button", {name:"Mute"}));
    await waitFor(() => expect(nativeInvoke).toHaveBeenCalledWith("smartcast_run", {operation:"key",input:'{"key":"MUTE_TOGGLE"}'}));
    await waitFor(() => expect(screen.getByRole("button", {name:"Power"})).toBeEnabled());
    fireEvent.click(screen.getByRole("button", {name:"Power"}));
    await waitFor(() => expect(nativeInvoke).toHaveBeenCalledWith("smartcast_run", {operation:"key",input:'{"key":"POW_TOGGLE"}'}));
  });

  it("reuses a paired TV but disables launch until a receiver is configured", async () => {
    native();
    nativeInvoke.mockImplementation(async command => command === "smartcast_run" ? complete() : undefined);
    render(<CastController onClose={() => {}} />);
    enterAddress();
    await screen.findByText("Connected to your TV.");
    expect(screen.getByRole("button", { name: "Open VIPTV on TV" })).toBeDisabled();
    expect(screen.getByText(/A TV receiver has not been configured/)).toBeVisible();
    expect(nativeInvoke).not.toHaveBeenCalledWith("smartcast_run", expect.objectContaining({ operation: "beginPair" }));
  });

  it("keeps the PIN entry reachable when beginPair fails at the transport", async () => {
    // The shared core's `beginPair` is a PUT /pairing/start: the set displays a code as
    // soon as it accepts that request, and the host reports `transport` (reject) or
    // `invalidResponse` when the reply is lost or unusable. A failed attempt therefore
    // cannot hide the PIN field or read as an unreachable TV.
    native();
    let attempts = 0;
    nativeInvoke.mockImplementation(async (command, args) => {
      if (command === "smartcast_discover") return "[]";
      if (command === "smartcast_configure") return undefined;
      if (command !== "smartcast_run") return undefined;
      switch ((args as Record<string, unknown> | undefined)?.operation) {
        case "pingAuth": return authentication;
        case "beginPair": return ++attempts === 1 ? transportFailure : complete({ challengeType: 1, token: 42 });
        case "finishPair": return complete({ paired: true });
        default: return complete();
      }
    });
    render(<CastController onClose={() => {}} />);
    enterAddress();
    // The field and the real fault stay together: no address form, no unreachable-TV copy.
    expect(await screen.findByLabelText("PIN shown on your TV")).toBeVisible();
    expect(screen.getByText("The pairing request failed on the network. Get a new PIN to try again.")).toBeVisible();
    expect(screen.queryByText(/did not return a pairing challenge/)).not.toBeInTheDocument();
    expect(screen.queryByText(/native TV controller is unavailable/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("TV IP address")).not.toBeInTheDocument();
    // The code on screen belongs to the attempt that lost its token; a fresh challenge
    // replaces it and then pairs with the code the TV shows for that attempt.
    fireEvent.click(screen.getByRole("button", { name: "Get a new PIN" }));
    await screen.findByText("Enter the PIN displayed on your TV.");
    fireEvent.change(screen.getByLabelText("PIN shown on your TV"), { target: { value: "1234" } });
    fireEvent.click(screen.getByRole("button", { name: "Pair TV" }));
    await screen.findByText("Paired with your TV.");
    expect(nativeInvoke).toHaveBeenCalledWith("smartcast_run", { operation: "beginPair", input: "{}" });
    expect(nativeInvoke).toHaveBeenCalledWith("smartcast_run", { operation: "finishPair", input: JSON.stringify({ challengeType: 1, token: 42, pin: "1234" }) });
  });

  it("names a host that never answered beginPair instead of blaming the app", async () => {
    native();
    nativeInvoke.mockImplementation(async (command, args) => {
      if (command === "smartcast_discover") return "[]";
      if (command === "smartcast_configure") return undefined;
      if (command !== "smartcast_run") return undefined;
      switch ((args as Record<string, unknown> | undefined)?.operation) {
        case "pingAuth": return authentication;
        case "beginPair": throw new Error("SmartCast core is unavailable");
        default: return complete();
      }
    });
    render(<CastController onClose={() => {}} />);
    enterAddress();
    expect(await screen.findByLabelText("PIN shown on your TV")).toBeVisible();
    expect(screen.getByText("The desktop host did not answer the pairing request. Get a new PIN to try again.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Get a new PIN" })).toBeEnabled();
    expect(screen.queryByText(/Use a VIPTV desktop app with SmartCast support/)).not.toBeInTheDocument();
  });

  it("cancels a PIN challenge and permits entering another TV", async () => {
    native(); pairingBoundary();
    render(<CastController onClose={() => {}} />);
    enterAddress();
    fireEvent.change(await screen.findByLabelText("PIN shown on your TV"), { target: { value: "1234" } });
    fireEvent.click(screen.getByRole("button", { name: "Change TV" }));
    // The revealed manual form persists across the teardown, so the next
    // TV address can be typed immediately.
    expect(await screen.findByLabelText("TV IP address")).toHaveValue("");
    expect(screen.queryByLabelText("PIN shown on your TV")).not.toBeInTheDocument();
    expect(nativeInvoke).toHaveBeenCalledWith("smartcast_run", { operation: "cancelPair", input: "{}" });
  });

  it.each(["close", "unmount"])("cancels pending native I/O on %s", async disposition => {
    native();
    nativeInvoke.mockImplementation((command) => command === "smartcast_run" ? new Promise(() => {}) : Promise.resolve(undefined));
    const onClose = vi.fn();
    const view = render(<CastController onClose={onClose} />);
    enterAddress();
    await waitFor(() => expect(nativeInvoke).toHaveBeenCalledWith("smartcast_run", { operation: "pingAuth", input: "{}" }));
    // While the TV is contacted the Close action is disabled (DeskCastBusy); the × disc still closes.
    if (disposition === "close") {
      expect(screen.getAllByRole("button", { name: "Close" }).find(button => button.textContent === "Close")).toBeDisabled();
      fireEvent.click(screen.getAllByRole("button", { name: "Close" }).find(button => button.classList.contains("vx-close"))!);
      expect(onClose).toHaveBeenCalledOnce();
    }
    else view.unmount();
    expect(nativeInvoke).toHaveBeenCalledWith("smartcast_cancel");
  });
});
