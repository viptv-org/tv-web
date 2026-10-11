import type { TvProfile } from "../api";
import catalog from "../../design-contract/assets/roku/roku/data/avatar-catalog.json";

/* ---- Avatar catalog -------------------------------------------------------
 * The pinned design catalog is the single source for both the React and
 * SolidTV profile surfaces, matching Android and Roku. Generated worlds have
 * `per_category` choices in public/assets/avatar-catalog; character worlds
 * list their own items, bundled in public/assets/avatar-characters. Choices
 * are stable 1-based positions within a world. */
export interface AvatarWorld {
  style: string;
  name: string;
  count: number;
}

type Category = (typeof catalog.categories)[number];
const items = (category: Category) => ("items" in category ? category.items : undefined);
const characterPrefix = "pkg:/images/";

export const avatarWorlds: AvatarWorld[] = catalog.categories.map((category) => ({
  style: category.style,
  name: category.name,
  count: items(category)?.length ?? catalog.per_category,
}));
export const avatarCount = avatarWorlds.reduce((total, world) => total + world.count, 0);
export const avatarWorld = (style: string) => avatarWorlds.find((world) => world.style === style);

/** Catalog avatar image, or "" when the style or choice is not in the catalog. */
export const avatarSrc = (style: string, choice: number) => {
  const category = catalog.categories.find((entry) => entry.style === style);
  if (!category || !Number.isInteger(choice) || choice < 1) return "";
  const list = items(category);
  if (!list) return choice <= catalog.per_category ? `${import.meta.env.BASE_URL}assets/avatar-catalog/${style}-${choice}.png` : "";
  const local = list[choice - 1]?.local;
  return local?.startsWith(characterPrefix) ? `${import.meta.env.BASE_URL}assets/${local.slice(characterPrefix.length)}` : "";
};

/** The persisted avatar selection of a profile, with the backend defaults. */
export const profileAvatarChoice = (profile: TvProfile | undefined) => ({
  style: typeof profile?.raw.avatar_style === "string" ? profile.raw.avatar_style : "critters",
  choice: typeof profile?.raw.avatar_choice === "number" ? profile.raw.avatar_choice : 1,
});

export const profileAvatarSrc = (profile: TvProfile) => {
  const { style, choice } = profileAvatarChoice(profile);
  return avatarSrc(style, choice);
};
