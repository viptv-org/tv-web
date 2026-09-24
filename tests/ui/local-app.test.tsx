import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LocalApp } from "../../src/ui/LocalApp";

const metas = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    type: "movie",
    id: `m${index}`,
    name: `Title ${index}`,
    poster: `https://example.test/p${index}.jpg`,
  }));

const manifest = {
  id: "com.example.addon",
  name: "Example",
  catalogs: [
    {
      type: "movie",
      id: "top",
      name: "Top Movies",
      extra: [{ name: "genre", isRequired: false, options: ["Action", "Drama"] }],
    },
  ],
};

const routes: Record<string, unknown> = {
  "https://example.test/manifest.json": manifest,
  "https://example.test/catalog/movie/top.json": { metas: metas(6) },
  "https://example.test/catalog/movie/top/genre=Action.json": { metas: metas(2) },
};

const localFetch = vi.fn(async (input: RequestInfo | URL) => {
  const body = routes[String(input)];
  if (body === undefined) return new Response("missing", { status: 404 });
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
});

vi.stubGlobal("fetch", localFetch);

beforeEach(() => {
  globalThis.localStorage.clear();
  localFetch.mockClear();
});

afterEach(() => {
  globalThis.localStorage.clear();
});

it("renders home shelves from the local addon registry", async () => {
  globalThis.localStorage.setItem("viptv.local.registry.v1", JSON.stringify({
    version: 1,
    nextOrdinal: 2,
    addons: [{
      ordinal: 1,
      id: "com.example.addon",
      manifestUrl: "https://example.test/manifest.json",
      manifest,
      installedAt: 1,
      enabled: true,
    }],
  }));
  render(<LocalApp onExit={() => {}} />);
  expect(await screen.findByText("Top Movies")).toBeInTheDocument();
  expect(screen.getAllByRole("figure")).toHaveLength(6);
  expect(screen.getByRole("heading", { name: "Top Movies" })).toBeInTheDocument();
});

it("shows the empty state and routes to addon management", async () => {
  render(<LocalApp onExit={() => {}} />);
  expect(await screen.findByText("Install an addon to start browsing.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Add an addon" }));
  expect(screen.getByLabelText("Addon manifest URL")).toBeInTheDocument();
  expect(screen.getByText("No addons installed yet.")).toBeInTheDocument();
});

it("installs an addon from the management surface and returns to shelves", async () => {
  render(<LocalApp onExit={() => {}} />);
  expect(await screen.findByText("Install an addon to start browsing.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Add an addon" }));
  fireEvent.change(screen.getByLabelText("Addon manifest URL"), {
    target: { value: "https://example.test/manifest.json" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Install addon" }));
  fireEvent.click(screen.getByRole("button", { name: "Home" }));
  expect(await screen.findByText("Top Movies")).toBeInTheDocument();
});

it("surfaces the design's install failure copy", async () => {
  render(<LocalApp onExit={() => {}} />);
  expect(await screen.findByText("Install an addon to start browsing.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Add an addon" }));
  fireEvent.change(screen.getByLabelText("Addon manifest URL"), {
    target: { value: "not-a-url" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Install addon" }));
  expect(await screen.findByText("That does not look like an addon URL.")).toBeInTheDocument();
});

it("removes an addon after confirmation and returns to the empty state", async () => {
  globalThis.localStorage.setItem("viptv.local.registry.v1", JSON.stringify({
    version: 1,
    nextOrdinal: 2,
    addons: [{
      ordinal: 1,
      id: "com.example.addon",
      manifestUrl: "https://example.test/manifest.json",
      manifest,
      installedAt: 1,
      enabled: true,
    }],
  }));
  render(<LocalApp onExit={() => {}} />);
  expect(await screen.findByText("Top Movies")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Addons" }));
  const remove = await screen.findByRole("button", { name: "Remove" });
  fireEvent.click(remove);
  const dialog = screen.getByRole("dialog", { name: "Remove Example?" });
  expect(dialog).toHaveTextContent("Its catalogs leave this device.");
  fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }));
  await waitFor(() => expect(screen.getByText("No addons installed yet.")).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "Home" }));
  expect(await screen.findByText("Install an addon to start browsing.")).toBeInTheDocument();
});

it("cancelling removal keeps the addon", async () => {
  globalThis.localStorage.setItem("viptv.local.registry.v1", JSON.stringify({
    version: 1,
    nextOrdinal: 2,
    addons: [{
      ordinal: 1,
      id: "com.example.addon",
      manifestUrl: "https://example.test/manifest.json",
      manifest,
      installedAt: 1,
      enabled: true,
    }],
  }));
  render(<LocalApp onExit={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: "Addons" }));
  fireEvent.click(await screen.findByRole("button", { name: "Remove" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(await screen.findByText("com.example.addon")).toBeInTheDocument();
});

it("exits local mode through the header action", async () => {
  globalThis.localStorage.setItem("viptv.local.registry.v1", JSON.stringify({
    version: 1,
    nextOrdinal: 2,
    addons: [{
      ordinal: 1,
      id: "com.example.addon",
      manifestUrl: "https://example.test/manifest.json",
      manifest,
      installedAt: 1,
      enabled: true,
    }],
  }));
  const onExit = vi.fn();
  render(<LocalApp onExit={onExit} />);
  expect(await screen.findByText("Top Movies")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Sign in to an account" }));
  expect(onExit).toHaveBeenCalled();
  expect(globalThis.localStorage.getItem("viptv.local.mode.v1")).toBeNull();
});

it("browse shows declared genre filters and filters the catalog", async () => {
  globalThis.localStorage.setItem("viptv.local.registry.v1", JSON.stringify({
    version: 1,
    nextOrdinal: 2,
    addons: [{
      ordinal: 1,
      id: "com.example.addon",
      manifestUrl: "https://example.test/manifest.json",
      manifest,
      installedAt: 1,
      enabled: true,
    }],
  }));
  render(<LocalApp onExit={() => {}} />);
  expect(await screen.findByText("Top Movies")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "More from Top Movies" }));
  expect(await screen.findByText("Title 3")).toBeInTheDocument();
  const genre = screen.getByLabelText("Genre");
  expect(genre).toHaveValue("");
  fireEvent.change(genre, { target: { value: "Action" } });
  await waitFor(() => expect(screen.getAllByRole("figure")).toHaveLength(2));
});


