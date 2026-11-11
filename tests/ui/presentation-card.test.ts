import { expect, it } from "vitest";
import { presentationCard } from "../../src/tv-solid/remote/presentation-card";
import type { Card } from "../../src/tv-solid/remote/types";

const first = { identity: { id: "movie", kind: "movie" }, provider_id: "stremio", title: "Movie",
  description: "Known synopsis", logo: "logo.png", landscape: "backdrop.jpg", progress: .1 } as Card;

it("keeps a shown synopsis and artwork through a partial refresh but accepts fresh progress", () => {
  const next = { ...first, description: null, logo: null, landscape: null, progress: .2 };
  expect(presentationCard(first, next)).toMatchObject({ description: first.description, logo: first.logo, landscape: first.landscape, progress: .2 });
  expect(next.description).toBeNull();
  expect(presentationCard(first, { ...first, description: "  ", logo: "" })).toMatchObject({description:first.description,logo:first.logo});
});

it("accepts a corrected synopsis and never borrows data for another title or authority", () => {
  expect(presentationCard(first, { ...first, description: "Corrected" }).description).toBe("Corrected");
  const other = { ...first, identity: { ...first.identity, id: "other" }, description: null };
  expect(presentationCard(first, other).description).toBeNull();
  expect(presentationCard(first, { ...first, provider_id: "simkl", description: null }).description).toBeNull();
});

it("does not mix two episodes or different metadata connection incarnations", () => {
  const episode = { ...first, identity: { ...first.identity, kind: "series", episode: { season: 1, episode: 1 } } } as Card;
  const next = { ...episode, identity: { ...episode.identity, episode: { season: 1, episode: 2 } }, description: null } as Card;
  expect(presentationCard(episode, next).description).toBeNull();
  const a = { ...first, metadata_origin: { provider_id: "stremio", connection_id: "addon:1", incarnation: "a" } } as Card;
  const b = { ...a, metadata_origin: { ...a.metadata_origin!, incarnation: "b" }, description: null } as Card;
  expect(presentationCard(a, b).description).toBeNull();
});

it("retains the incoming synopsis while another title is still displayed", () => {
  const incoming = { ...first, identity: { ...first.identity, id: "incoming" }, description: "Prepared synopsis" };
  const refreshed = { ...incoming, description: null, progress: .3 };
  expect(presentationCard(first, refreshed, incoming)).toMatchObject({ description: "Prepared synopsis", progress: .3 });
  expect(presentationCard(first, { ...refreshed, description: "Corrected incoming synopsis" }, incoming).description)
    .toBe("Corrected incoming synopsis");
});

it("never borrows pending metadata from another authority", () => {
  const incoming = { ...first, provider_id: "simkl", description: "Other authority" };
  expect(presentationCard(undefined, { ...first, description: null }, incoming).description).toBeNull();
});
