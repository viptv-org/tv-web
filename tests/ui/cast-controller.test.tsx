import { webcrypto } from "node:crypto";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { CastController } from "../../src/ui/CastController";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
const nativeInvoke = vi.mocked(invoke);
const complete = (result: Record<string, unknown> = {}) => JSON.stringify({ kind: "complete", result, credentialChanged: false });
const authentication = JSON.stringify({ kind: "error", error: { kind: "authentication", message: "TV requires pairing" } });

function native() { Object.defineProperty(window, "__TAURI_INTERNALS__", { value: {}, configurable: true }); }
function enterAddress() {
  fireEvent.change(screen.getByLabelText("TV IP address"), { target: { value: "192.168.1.50" } });
  fireEvent.click(screen.getByRole("button", { name: "Connect" }));
}
function pairingBoundary() {
  nativeInvoke.mockImplementation(async (command, args) => {
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
    expect(nativeInvoke).not.toHaveBeenCalled();
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

  it("cancels a PIN challenge and permits entering another TV", async () => {
    native(); pairingBoundary();
    render(<CastController onClose={() => {}} />);
    enterAddress();
    fireEvent.change(await screen.findByLabelText("PIN shown on your TV"), { target: { value: "1234" } });
    fireEvent.click(screen.getByRole("button", { name: "Change TV" }));
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
    if (disposition === "close") { fireEvent.click(screen.getByRole("button", { name: "Close" })); expect(onClose).toHaveBeenCalledOnce(); }
    else view.unmount();
    expect(nativeInvoke).toHaveBeenCalledWith("smartcast_cancel");
  });
});
