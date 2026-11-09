import { expect, it } from "vitest";
import { initialSeasonIndex, seasonLabel, episodeActionLabel, seasonEpisodes } from "../../src/tv-solid/remote/seasons";
import type { Card, Detail, TitleAction } from "../../src/tv-solid/remote/types";

const title = { identity: { id: "show", kind: "series" }, title: "Show" } as Card;
const special = { ...title, identity: { ...title.identity, episode: { season: 0, episode: 1 } } } as Card;
const detail = { seasons: [{ season: 0, offset: 0 }, { season: 1, offset: 4 }, { season: 2, offset: 12 }] } as Detail;
const action = { card: special, resume: false } as TitleAction;

it("names special and unknown season groups without exposing a zero season", () => {
  expect(seasonLabel(0)).toBe("Specials");
  expect(seasonLabel(1)).toBe("Season 1");
  expect(seasonLabel(null)).toBe("Episodes");
  expect(episodeActionLabel(special, "Resume")).toBe("Resume Special 1");
});

it("lands a new shelf on the first regular season even if the first page contains specials", () => {
  expect(initialSeasonIndex(detail, title, action)).toBe(1);
  expect(initialSeasonIndex({ ...detail, seasons: [detail.seasons[0]] }, title, action)).toBe(0);
});

it("retains an explicitly selected or resumed special and a resumed later season", () => {
  expect(initialSeasonIndex(detail, special, action)).toBe(0);
  expect(initialSeasonIndex(detail, title, { ...action, resume: true })).toBe(0);
  const later = { ...special, identity: { ...special.identity, episode: { season: 2, episode: 3 } } } as Card;
  expect(initialSeasonIndex(detail, title, { ...action, card: later, resume: true })).toBe(2);
});

it("does not show specials or the following season from a page that crosses boundaries", () => {
  const regular = { ...special, identity: { ...special.identity, episode: { season: 1, episode: 1 } } } as Card;
  const next = { ...special, identity: { ...special.identity, episode: { season: 2, episode: 1 } } } as Card;
  expect(seasonEpisodes({ ...detail, episodes: [special, regular, next] }, 1)).toEqual([regular]);
  expect(seasonEpisodes({ ...detail, episodes: [special, regular, next] }, 0)).toEqual([special]);
});
