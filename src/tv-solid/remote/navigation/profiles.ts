import type { Accessor } from "solid-js";
import type { NavigationFocus } from "./focus";

export function createProfilesNavigation(options: {
  focus: NavigationFocus;
  count: Accessor<number>;
  canCreate: Accessor<boolean>;
  canManage: Accessor<boolean>;
}) {
  const focus = options.focus;
  return (dx: number, dy: number) => {
    if (dy > 0) { if (options.canManage()) focus.setZone("profile-manage"); return; }
    if (dy < 0) { focus.setZone("profiles"); return; }
    focus.setColumn(index => Math.max(0, Math.min(options.count() - (options.canCreate() ? 0 : 1), index + dx)));
  };
}
