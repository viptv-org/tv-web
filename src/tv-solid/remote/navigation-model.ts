import type { Bootstrap } from "./types";

const navigationTemplates = [
  { id: "search", label: "" },
  { id: "home", label: "Home" },
  { id: "movie", label: "Movies" },
  { id: "series", label: "Series" },
  { id: "anime", label: "Anime" },
  { id: "live", label: "Live" },
  { id: "calendar", label: "Calendar" },
  { id: "library", label: "My List" },
  { id: "profiles", label: "Profile" },
] as const;
export type NavId = (typeof navigationTemplates)[number]["id"];
export type NavigationItem = {
  id: NavId;
  label: string;
  media_search?: boolean;
  channel_search?: boolean;
};


export function availableNavigation(navigation: Bootstrap["navigation"]): NavigationItem[] {
  const source =
    navigation ??
    navigationTemplates.filter(
      (item) => item.id === "home" || item.id === "profiles",
    );
  const byId = new Map(source.map((item) => [item.id, item]));
  const order = [
    "search",
    "home",
    "movie",
    "series",
    "anime",
    "live",
    "calendar",
    "library",
    "profiles",
  ];
  return order.flatMap((id) => {
    const template = navigationTemplates.find((item) => item.id === id);
    if (!template) return [];
    const item = byId.get(id);
    if (item) return [{ ...item, id: template.id }];
    // The Android TV rail always keeps Anime; the web navigation contract
    // predates the catalog even though discovery-controls supports it.
    if (id === "anime") return [{ id: template.id, label: template.label }];
    return [];
  });

}
