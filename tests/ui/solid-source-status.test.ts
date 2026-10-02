import { describe, expect, it } from "vitest";
import type { MediaItem, MediaSource } from "../../src/api";
import { projectSources } from "../../src/tv-solid/sourceModel";

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
});
