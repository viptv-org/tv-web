import { describe, expect, it, vi } from "vitest";
import type { MediaItem, TvApi } from "../../src/api";
import { detailEpisodeWindow, emptyDetail, loadDetailView, selectDetailSeason } from "../../src/tv-solid/detailModel";

const show: MediaItem = { id: "show", type: "series", name: "Show", title: "Show", genres: [], episodes: [], raw: {} };
const episode = (season: number, number: number): MediaItem => ({ ...show, id: `show:${season}:${number}`, seriesId: show.id, season, episode: number, episodeTitle: `Episode ${number}`, duration: 120 });

describe("SolidTV season projection", () => {
  it("keeps canonical progress and primary Resume while browsing another season", async () => {
    const one = episode(1, 1), two = episode(2, 1);
    const resume = { ...two, position: 42, sourceAddonId: "iptv:7", sourceFingerprint: "saved-source" };
    const api = { detail: vi.fn(async () => ({ item: show, episodes: [two, one] })), seriesProgress: vi.fn(async () => [resume]) } as unknown as TvApi;
    const detail = await loadDetailView(api, resume, "profile", [], new AbortController().signal);
    expect(detail.seasons).toEqual([1, 2]);
    expect(detail.season).toBe(2);
    expect(detail.target).toMatchObject({ id: two.id, position: 42, sourceFingerprint: "saved-source" });
    expect(detail.playLabel).toBe("Resume S2 E1");
    const firstSeason = selectDetailSeason(detail, 1);
    expect(firstSeason.episodes.map(row => row.item?.id)).toEqual([one.id]);
    expect(firstSeason.target).toBe(detail.target);
    expect(firstSeason.playLabel).toBe("Resume S2 E1");
    expect(firstSeason.allEpisodes).toBe(detail.allEpisodes);
    const restored = selectDetailSeason(firstSeason, 2);
    expect(restored.episodes[0]).toMatchObject({ watching: true, progress: 0.35, item: { sourceFingerprint: "saved-source" } });
    expect(api.detail).toHaveBeenCalledTimes(1);
    expect(api.seriesProgress).toHaveBeenCalledTimes(1);
  });

  it("offers numerically sorted seasons including specials without dropping any episodes", () => {
    const allEpisodes = [episode(0, 1), episode(1, 1), episode(2, 1), episode(2, 2)];
    const detail = { ...emptyDetail, allEpisodes, seasons: [0, 1, 2] };
    expect(selectDetailSeason(detail, 0).episodes[0].item).toBe(allEpisodes[0]);
    expect(selectDetailSeason(detail, 2).episodeCount).toBe(2);
    expect(selectDetailSeason(detail, 99)).toBe(detail);
    expect(selectDetailSeason(detail, NaN)).toBe(detail);
  });

  it("bounds large season render windows and leaves canonical items intact", () => {
    const allEpisodes = Array.from({ length: 100 }, (_, index) => episode(1, index + 1));
    const detail = selectDetailSeason({ ...emptyDetail, allEpisodes, seasons: [1] }, 1);
    const last = detailEpisodeWindow(detail, 99, 3);
    expect(last.start).toBe(97);
    expect(last.total).toBe(100);
    expect(last.episodes.map(row => row.item?.episode)).toEqual([98, 99, 100]);
    expect(detailEpisodeWindow(detail, -10, 3).start).toBe(0);
    expect(detailEpisodeWindow(emptyDetail, 50).episodes).toEqual([]);
    expect(detail.allEpisodes).toHaveLength(100);
    expect(detail.episodes).toHaveLength(100);
  });
});
