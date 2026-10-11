import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { TvProfile } from "../../src/api";
import { avatarCount, avatarSrc, avatarWorlds, profileAvatarSrc } from "../../src/ui/avatarCatalog";

const root = resolve(import.meta.dirname, "../..");
const profile = (raw: Record<string, unknown>) => ({ id: "1", name: "Ada", raw }) as unknown as TvProfile;

describe("avatar catalog", () => {
  it("offers every design world, including the character worlds", () => {
    expect(avatarWorlds.map((world) => world.style)).toEqual(expect.arrayContaining(["disney", "princesses", "animal-friends", "villains", "critters"]));
    expect(avatarWorlds).toHaveLength(16);
    expect(avatarCount).toBe(624);
  });

  it("resolves every choice to bundled artwork", () => {
    for (const world of avatarWorlds)
      for (let choice = 1; choice <= world.count; choice++) {
        const src = avatarSrc(world.style, choice);
        expect(src, `${world.style} ${choice}`).toMatch(/^\/assets\/avatar-(catalog|characters)\//);
        expect(existsSync(resolve(root, "public", src.slice(1))), src).toBe(true);
      }
  });

  it("returns no image for unknown styles or out-of-range choices", () => {
    expect(avatarSrc("disney", 15)).toBe("");
    expect(avatarSrc("critters", 49)).toBe("");
    expect(avatarSrc("retired", 1)).toBe("");
    expect(avatarSrc("critters", 0)).toBe("");
  });

  it("reads a profile's selection with the backend defaults", () => {
    expect(profileAvatarSrc(profile({ avatar_style: "villains", avatar_choice: 2 }))).toBe("/assets/avatar-characters/villains-2.png");
    expect(profileAvatarSrc(profile({}))).toBe("/assets/avatar-catalog/critters-1.png");
  });
});
