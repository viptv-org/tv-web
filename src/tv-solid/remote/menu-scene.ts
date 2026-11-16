import type { Accessor } from "solid-js";
import type { Card, Channel, TitleAction } from "./types";
import type { Overlay } from "./app-types";
import type { PlayIntent } from "./source-picker/intent-types";
import type { SourcePickerScene } from "./source-picker-scene";
import type { PlayerScene } from "./player-scene";
import type { PlayerChrome } from "./player-chrome";

/** The menu key and the hold's identity.
 *
 * Both answer one question: what is the viewer pointing at? `pressTarget` turns
 * that into a string so a 700 ms hold can be cancelled by any focus change, and
 * `menu` acts on the same answer. Keeping them together is why a hold released
 * over a different card cannot open the previous card's menu.
 */
export function createMenuScene(options: {
  screen: Accessor<string>;
  zone: Accessor<string>;
  column: Accessor<number>;
  row: Accessor<number>;
  choice: Accessor<number>;
  key: Accessor<number>;
  heroAction: Accessor<number>;
  overlay: Accessor<Overlay | undefined>;
  focusedSource: Accessor<{ id: string } | undefined>;
  sourceFilterFocus: Accessor<boolean>;
  sourceFacet: Accessor<number>;
  sourcePage: Accessor<{ quality_filters?: { height?: number }[] } | undefined>;
  selected: Accessor<Card | undefined>;
  focusedCard: Accessor<Card | undefined>;
  heroIntentCard: () => Card | null | undefined;
  isSaved: (card: Card) => boolean;
  cardKey: (card: Card) => string;
  channels: Accessor<Channel[]>;
  searchChannels: Accessor<Channel[]>;
  settingsItems: Accessor<{ run: () => unknown }[]>;
  visibleSources: Accessor<unknown[]>;
  sourceActions: Accessor<boolean>;
  sourceMenu: Accessor<"quality" | "provider" | undefined>;
  setSourceActions: (value: boolean) => void;
  setSourceActionChoice: (value: number) => void;
  picker: SourcePickerScene;
  player: PlayerScene["player"];
  playerScene: Pick<PlayerScene, "advanceEpisode" | "revealEndedControls">;
  chrome: PlayerChrome;
  activeAction: Accessor<TitleAction | undefined>;
  activeChannel: Accessor<string | undefined>;
  playIntent: PlayIntent;
  advanceEpisode: (forcePicker?: boolean) => Promise<void>;
  countdown: { cancel: () => void };
  showLiveMenu: (channel: Channel) => void;
  showCardMenu: (card: Card) => void;
  manageProfile: (index: number) => void;
  canManageProfiles: () => boolean;
  fail: (error: unknown) => void;
}) {
  /** The identity of whatever the hold started on. */
  function pressTarget(): string {
    const modal = options.overlay();
    if (modal?.kind === "sources")
      return JSON.stringify([
        "sources",
        options.sourceFilterFocus()
          ? ["filter", options.sourcePage()?.quality_filters?.[options.sourceFacet() - 1]?.height]
          : ["source", options.focusedSource()?.id],
        options.selected() ? options.cardKey(options.selected()!) : null,
      ]);
    if (modal) return JSON.stringify([modal.kind, modal.kind === "text" ? options.key() : options.choice()]);
    // The hero term identifies the billboard only while the billboard is the
    // focused element. On a rows card the hero is the delayed preview, which
    // changes 400ms into a hold and would otherwise defeat the 700ms timer.
    const hero = options.heroIntentCard();
    return JSON.stringify([
      options.screen(), options.screen() === "player" ? options.choice() : null,
      options.zone(), options.column(), options.row(), options.heroAction(),
      options.zone() === "hero" ? (hero ? options.cardKey(hero) : null) : null,
      options.focusedCard() ? options.cardKey(options.focusedCard()!) : null,
      options.heroAction() === 1 && hero ? options.isSaved(hero) : null,
    ]);
  }

  function menu(): void {
    options.countdown.cancel();
    if (options.playerScene.revealEndedControls()) return;
    if (options.overlay()?.kind === "next") {
      if (options.choice() === 0) void options.advanceEpisode(true).catch(options.fail);
      return;
    }
    if (options.screen() === "player" && !options.overlay()) {
      if (options.chrome.buttons()[options.choice()]?.id === "next") void options.advanceEpisode(true).catch(options.fail);
      else if (options.activeAction())
        void options.playIntent(options.activeAction()!.card, true, false, options.activeChannel(),
          options.player.canReplaceSource).catch(options.fail);
      return;
    }
    if (options.sourceActions()) return;
    if (options.overlay()?.kind === "sources" && !options.sourceFilterFocus() &&
      !options.sourceMenu() && options.visibleSources().length) {
      options.setSourceActionChoice(0);
      options.setSourceActions(true);
      return;
    }
    if (options.overlay()) {
      if (options.overlay()?.kind === "sources") options.picker.manual.set(true);
      return;
    }
    if (options.screen() === "settings") {
      if (options.zone() === "settings-content")
        void Promise.resolve(options.settingsItems()[options.column()]?.run()).catch(options.fail);
      return;
    }
    const channel =
      options.screen() === "live" && options.zone() === "content"
        ? options.channels()[options.column()]
        : options.screen() === "search" && options.zone() === "search-channels"
          ? options.searchChannels()[options.column()]
          : undefined;
    if (channel) { options.showLiveMenu(channel); return; }
    if (options.screen() === "profiles") {
      if (options.canManageProfiles()) options.manageProfile(options.column());
      return;
    }
    if (["nav", "filters", "keyboard", "seasons"].includes(options.zone())) return;
    const card = options.zone() === "hero" ? options.heroIntentCard() : options.focusedCard();
    if (card) options.showCardMenu(card);
  }

  return { pressTarget, menu };
}
