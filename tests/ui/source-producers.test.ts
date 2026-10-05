import { describe, expect, it } from "vitest";
import type { MediaSource, StreamEvent } from "../../src/api";
import { configuredAddonNames, observeSourceProducers, producerStatus, sourceDescription, sourceDetails, sourceProviderKey } from "../../src/screens/sourceProducers";
import { matchesFilters } from "../../src/screens/titleSources";
import { normalizeCore } from "../../src/core";

const names = configuredAddonNames([
  { id: 3, name: "Torrentio" },
  { id: 4, name: "TorrentsDB" },
  { id: 8, name: "Torrentio TB" },
]);
const event = (source: string, errorCode?: string): StreamEvent => ({
  sequence: 1, source, sources: [], errorCode,
});
const row = { id: "http", name: "Stream", sourceAddonId: "addon:8" } as MediaSource;

describe("observed source add-on producers", () => {
  it("includes IPTV producers and configured provider artwork in All", () => {
    const rows = [{ id: "iptv-source", name: "IPTV One", sourceAddonId: "iptv:7", raw: {} }];
    const producers = observeSourceProducers([], [{ sequence: 1, source: "iptv:7", sources: rows }], new Map(), new Map([["iptv:7", "https://art.example/provider.png"]]));
    expect(producers).toHaveLength(1);
    expect(producers[0].label).toBe("IPTV One");
    expect(producers[0].icon).toBe("https://art.example/provider.png");
    expect(matchesFilters(rows[0], "All", "All")).toBe(true);
    expect(matchesFilters(rows[0], "All", producers[0].key)).toBe(true);
  });
  it("keeps distinct configured IDs including zero-result producers and ignores generic events", () => {
    const producers = observeSourceProducers([], [
      event("addon:3", "source_format_unsupported"),
      event("addon:4", "source_format_unsupported"),
      event("addon:8"),
      event("addon"),
    ], names);
    expect(producers.map(({ key, label }) => [key, label])).toEqual([
      ["addon:addon:3", "Torrentio"],
      ["addon:addon:4", "TorrentsDB"],
      ["addon:addon:8", "Torrentio TB"],
    ]);
    expect(producerStatus(producers[0], [row], false)).toBe("Still checking Torrentio");
    expect(producerStatus(producers[0], [row], true)).toContain("Choose another source.");
    expect(producerStatus(producers[1], [row], true)).toContain("TorrentsDB");
    expect(producerStatus(producers[2], [row], true)).toBe("");
    expect(sourceProviderKey(row)).toBe(producers[2].key);
    expect(normalizeCore<{ providerKey: string }>("sourceDisplay", row).providerKey).toBe(producers[2].key);
    expect(matchesFilters(row, "All", producers[2].key)).toBe(true);
    expect(matchesFilters(row, "All", producers[0].key)).toBe(false);
  });
  it("retains the core source body, including a distinct description, in the row and details", () => {
    const described = { id: "x", name: "Name", title: "Title", filename: "File", description: "Distinct description", audio: "French", sourceAddonId: "addon:8" } as MediaSource;
    expect(sourceDescription(described)).toContain("Distinct description");
    expect(sourceDescription(described)).toContain("French");
    expect(sourceDetails(described)).toContain("Distinct description");
    expect(sourceDetails(described)).toContain("File");
  });
});
