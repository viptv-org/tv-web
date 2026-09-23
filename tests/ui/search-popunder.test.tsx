import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Catalog, MediaItem, TvApi } from "../../src/api";
import { SearchPopunder } from "../../src/ui/SearchPopunder";

const title = (id: string, name: string): MediaItem =>
  ({ id, type: "movie", name, title: name, year: 2021, genres: [], episodes: [], raw: {} }) as unknown as MediaItem;
const catalogs = [
  { id: "top", name: "Top", type: "movie", addonId: 1, supportsSearch: true, supportsSkip: false, extras: [], genres: [], raw: {} },
  { id: "tv", name: "Channels", type: "live", addonId: 1, supportsSearch: true, supportsSkip: false, extras: [], genres: [], raw: {} },
] as unknown as Catalog[];

function fakeApi(items: readonly MediaItem[]) {
  const discover = vi.fn(async () => ({ items, hasMore: false }));
  const api = {
    discover,
    createScope() {
      const controller = new AbortController();
      return { signal: controller.signal, request: () => ({ signal: controller.signal }), abort: () => controller.abort() };
    },
  } as unknown as TvApi;
  return { api, discover };
}

function mount(items: readonly MediaItem[] = []) {
  const { api, discover } = fakeApi(items);
  const onOpen = vi.fn();
  const onSubmit = vi.fn();
  render(<SearchPopunder api={api} catalogs={catalogs} profile="p1" onOpen={onOpen} onSubmit={onSubmit} />);
  return { field: screen.getByRole("combobox", { name: "Search" }), discover, onOpen, onSubmit };
}

afterEach(() => localStorage.clear());

describe("desktop search popunder", () => {
  it("lists the profile's recent searches while empty and clears them", () => {
    localStorage.setItem("viptv:search:history:p1", JSON.stringify(["dune", "alien"]));
    localStorage.setItem("viptv:search:history:p2", JSON.stringify(["someone else"]));
    const { field, onSubmit } = mount();
    fireEvent.focus(field);
    const list = screen.getByRole("listbox", { name: "Recent searches" });
    expect(list).toHaveTextContent("dune");
    expect(list).not.toHaveTextContent("someone else");
    fireEvent.click(screen.getByRole("option", { name: "alien" }));
    expect(onSubmit).toHaveBeenCalledWith("alien");
    // The submitted text stays in the field; emptying it brings history back.
    expect(field).toHaveValue("alien");
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    fireEvent.focus(field);
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["alien", "dune"]);
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(localStorage.getItem("viptv:search:history:p1")).toBe("[]");
  });

  it("suggests matches from searchable non-live catalogs and opens the highlighted title", async () => {
    const moon = title("moon", "Moonlight");
    const { field, discover, onOpen, onSubmit } = mount([moon, title("moonfall", "Moonfall")]);
    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: "moon" } });
    expect(await screen.findByRole("option", { name: /Moonlight/ })).toBeVisible();
    expect(discover).toHaveBeenCalledTimes(1);
    expect(discover).toHaveBeenCalledWith(expect.objectContaining({ type: "movie", catalog: "top", search: "moon" }), expect.anything());
    fireEvent.keyDown(field, { key: "ArrowDown" });
    expect(field).toHaveAttribute("aria-activedescendant", "search-popunder-0");
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onOpen).toHaveBeenCalledWith(moon);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem("viptv:search:history:p1") ?? "[]")).toEqual(["moon"]);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("hands Enter to the full Search page and keeps Escape inside the field", async () => {
    const { field, onSubmit } = mount([title("star", "Star")]);
    const shell = vi.fn();
    window.addEventListener("keydown", shell);
    try {
      fireEvent.focus(field);
      fireEvent.change(field, { target: { value: "  star " } });
      await waitFor(() => expect(screen.getByRole("option", { name: /See all results/ })).toBeVisible());
      fireEvent.keyDown(field, { key: "Enter" });
      expect(onSubmit).toHaveBeenCalledWith("star");
      fireEvent.focus(field);
      expect(screen.getByRole("listbox")).toBeVisible();
      fireEvent.keyDown(field, { key: "Escape" });
      expect(screen.queryByRole("listbox")).toBeNull();
      // The app shell reads a window-level Escape as Back.
      expect(shell).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("keydown", shell);
    }
  });
});
