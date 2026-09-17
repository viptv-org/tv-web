import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TvApi, type TvProfile } from "../../src/api";
import { DialogBackdrop } from "../../src/ui/DialogBackdrop";
import { ProfileEditor } from "../../src/ui/ProfileEditor";
import { TextEntry } from "../../src/ui/TextEntry";

function backdrop() {
  return screen.getByRole("dialog").parentElement!;
}

describe("dialog backdrop cancellation", () => {
  it("ignores content clicks and drags out of the panel, then cancels a backdrop click once", () => {
    const cancel = vi.fn();
    render(<DialogBackdrop onCancel={cancel}><section role="dialog"><p>Content</p><button>Action</button></section></DialogBackdrop>);
    fireEvent.click(screen.getByText("Content"));
    fireEvent.click(screen.getByRole("button"));
    fireEvent.pointerDown(screen.getByText("Content"));
    fireEvent.click(backdrop());
    expect(cancel).not.toHaveBeenCalled();
    fireEvent.pointerDown(backdrop());
    fireEvent.click(backdrop());
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("discards text through Cancel without submitting the edited draft", () => {
    const cancel = vi.fn(), submit = vi.fn();
    render(<TextEntry title="Profile name" onCancel={cancel} onSubmit={submit} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Unsaved name" } });
    fireEvent.click(screen.getByRole("textbox"));
    expect(cancel).not.toHaveBeenCalled();
    fireEvent.click(backdrop());
    expect(cancel).toHaveBeenCalledOnce();
    expect(submit).not.toHaveBeenCalled();
  });

  const profile: TvProfile = { id: "2", name: "Viewer", setupComplete: true, raw: {} };
  function editor() {
    const api = new TvApi({ baseUrl: "https://viptv.example" });
    const cancel = vi.fn(), done = vi.fn(async () => {});
    const view = render(<ProfileEditor api={api} profile={profile} primary={false} onCancel={cancel} onDone={done} />);
    return { api, cancel, done, ...view };
  }

  it("cancels only the current avatar or delete step and restores its triggering control", () => {
    const { api, cancel } = editor();
    const remove = vi.spyOn(api, "deleteProfile");
    fireEvent.click(screen.getByRole("button", { name: "Change avatar" }));
    fireEvent.click(backdrop());
    expect(screen.getByRole("button", { name: "Change avatar" })).toHaveFocus();
    expect(cancel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete profile" }));
    fireEvent.click(backdrop());
    expect(screen.getByRole("button", { name: "Delete profile" })).toHaveFocus();
    expect(remove).not.toHaveBeenCalled();
    fireEvent.click(backdrop());
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("aborts a pending parent unlock and never saves after a late successful response", async () => {
    const { api, done } = editor();
    const update = vi.spyOn(api, "updateProfile").mockRejectedValue(Object.assign(new Error("Parent PIN required"), { status: 403 }));
    let resolveUnlock!: () => void;
    const unlock = vi.spyOn(api, "unlockParent").mockImplementation(() => new Promise<void>((resolve) => { resolveUnlock = resolve; }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    fireEvent.change(await screen.findByLabelText("Parent PIN", { selector: "input" }), { target: { value: "1234" } });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    const signal = unlock.mock.calls[0][1]?.signal;
    fireEvent.click(backdrop());
    expect(signal?.aborted).toBe(true);
    await act(async () => { resolveUnlock(); });
    expect(update).toHaveBeenCalledOnce();
    expect(done).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();
  });

  it("restores the editor opener after closing", async () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const { unmount } = editor();
    unmount();
    await waitFor(() => expect(opener).toHaveFocus());
    opener.remove();
  });
  it("traps Tab inside the dialog while it is open", () => {
    const outside = document.createElement("button");
    document.body.append(outside);
    const { unmount } = render(<DialogBackdrop onCancel={() => {}}><section role="dialog"><button>First</button><button>Second</button></section></DialogBackdrop>);
    const first = screen.getByRole("button", { name: "First" });
    const second = screen.getByRole("button", { name: "Second" });
    outside.focus();
    fireEvent.keyDown(backdrop(), { key: "Tab" });
    expect(first).toHaveFocus();
    second.focus();
    fireEvent.keyDown(backdrop(), { key: "Tab" });
    expect(first).toHaveFocus();
    first.focus();
    fireEvent.keyDown(backdrop(), { key: "Tab", shiftKey: true });
    expect(second).toHaveFocus();
    unmount();
    outside.remove();
  });

});
