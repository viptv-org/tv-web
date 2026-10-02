import { describe, expect, it } from "vitest";
import type { MediaItem, MediaSource } from "../../src/api";
import { projectSources, providerChoiceWindow } from "../../src/tv-solid/sourceModel";
import { observeSourceProducers, sourceProviderKey } from "../../src/screens/sourceProducers";

const item = { id: "film", type: "movie", name: "Film", title: "Film", genres: [], episodes: [], raw: {} } as MediaItem;
const source = { id: "first", name: "First", sourceName: "Addon", title: "Long file" } as MediaSource;

describe("SolidTV source discovery status", () => {
  it("keeps arriving sources usable while discovery is pending and clears progress on completion", () => {
    const initial = projectSources(item, [], true, false);
    expect(initial.status).toContain("Finding sources");
    const partial = projectSources(item, [source], true, false);
    expect(partial.status).toContain("Still checking sources");
    expect(partial.rows[0].id).toBe(source.id);
    const done = projectSources(item, [source], false, true);
    expect(done.status).not.toContain("checking sources");
    expect(done.rows[0].id).toBe(source.id);
  });
  it("filters the matching add-on key while preserving configured row names", () => {
    const owned = { ...source, sourceAddonId: "addon:8", sourceName: "Upstream name", description: "Distinct release detail" };
    const producers = observeSourceProducers([], [{ sequence: 1, source: "addon:8", sources: [] }], new Map([["addon:8", "Torrentio TB"]]));
    const selected = projectSources(item, [owned], false, true, "All", producers[0].key, producers);
    expect(selected.rows).toHaveLength(1);
    expect(selected.rows[0].provider).toBe("Torrentio TB");
    expect(selected.rows[0].file).toContain("Distinct release detail");
    expect(selected.provider).toBe(sourceProviderKey(owned));
    expect(projectSources(item, [owned], false, true, "All", "addon:addon:3", producers).rows).toHaveLength(0);
  });
  it("pages seven observed providers through six native focus nodes", () => {
    const options = ["All", ...Array.from({ length: 7 }, (_, index) => `addon:${index}`), "Cancel"];
    const initial = providerChoiceWindow(options, 0, 0);
    expect(initial.visible).toEqual(options.slice(0, 6));
    const seventh = providerChoiceWindow(options, initial.start, 7);
    expect(seventh.visible).toContain("addon:6");
    expect(seventh.visible[7 - seventh.start]).toBe("addon:6");
    const back = providerChoiceWindow(options, seventh.start, 0);
    expect(back.visible[0]).toBe("All");
  });
});
