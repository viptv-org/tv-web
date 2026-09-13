import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TextEntry } from "../../src/ui/TextEntry";
import { RemoteRoot } from "../../src/ui/remote";
describe("TV text entry", () => {
  it("keeps a rejected draft editable and submits the corrected value", async () => {
    const submit = vi.fn(async (value: string) => {
      if (value === "A") throw new Error("Use at least two characters");
    });
    render(
      <RemoteRoot>
        <TextEntry
          title="Profile name"
          initialValue="A"
          onSubmit={submit}
          onCancel={() => {}}
        />
      </RemoteRoot>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Use at least two characters",
    );
    fireEvent.click(screen.getByRole("button", { name: /^b$/ }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(submit).toHaveBeenLastCalledWith("Ab");
  });
});
