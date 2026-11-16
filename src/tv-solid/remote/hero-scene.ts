import { batch, createEffect, createMemo, createSignal, onCleanup, untrack, type Accessor } from "solid-js";
import { createCoherentHero } from "./CoherentHero";
import { createHeroCycle } from "./hero-cycle-controller";
import { CAROUSEL_TOP } from "./hero-stage";
import { compactDetail, detailLogoBox, homeLogoBox, type HeroMode } from "./hero-layout";
import { presentationCard, presentationKey } from "./presentation-card";
import { cardKey, type Card, type Detail, type Home } from "./types";

/** Home's featured presentation: which title the hero shows, the carousel that
 * advances it, the preview a focused shelf card asks for, and the prepared
 * artwork both of them share.
 *
 * The rule that keeps this honest is that the hero, the preview and the
 * billboard all read the *same* prepared card, so the picture, the title and the
 * progress bar can never describe different titles.
 */
export function createHeroScene(options: {
  home: Accessor<Home | undefined>;
  detail: Accessor<Detail | undefined>;
  screen: Accessor<string>;
  zone: Accessor<string>;
  row: Accessor<number>;
  column: Accessor<number>;
  overlayVisible: Accessor<boolean>;
  pending: Accessor<boolean>;
  loading: Accessor<boolean>;
  error: Accessor<string>;
  screenSaver: Accessor<boolean>;
  deviceScope: Accessor<string>;
  focusedCard: Accessor<Card | undefined>;
  detailHasEpisodes: Accessor<boolean>;
  /** Home's row-focus memory, so a returning row keeps its column. */
  rowFocus: { remember: (row: Home["rows"][number] | undefined, column: number) => void };
  observer?: (event: Record<string, unknown>) => void;
}) {
  const heroCycle = createHeroCycle({
    count: () => options.home()?.featured.length ?? 0,
    enabled: () =>
      options.screenSaver()
        ? options.screen() !== "player"
        : options.screen() === "home" && options.zone() !== "rows" &&
          !options.overlayVisible() && !options.pending() && !options.loading() && !options.error(),
  });
  const [previewCard, setPreviewCard] = createSignal<Card>();
  let previewGeneration = 0, previewScope = "";
  let previewCandidate: Card | undefined;
  createEffect(() => {
    const focused = options.focusedCard(), active = options.zone() === "rows", currentScope = options.deviceScope();
    options.observer?.({ phase: "home-focus", at: performance.now(), row: options.row(),
      rowId: options.home()?.rows[options.row()]?.id, cards: options.home()?.rows[options.row()]?.cards.length,
      complete: options.home()?.complete, active });
    const previous = previewScope === currentScope ? previewCandidate ?? untrack(previewCard) : undefined;
    previewScope = currentScope;
    const card = focused && active ? presentationCard(previous, focused) : undefined;
    previewCandidate = card;
    // A stale settle can still fire if the cleanup's clearTimeout loses a race
    // against the fake clock's fast-forward; the generation guard makes such a
    // fire a no-op so a skipped-over card never flashes its preview.
    const generation = ++previewGeneration;
    const timer = setTimeout(() => {
      if (generation === previewGeneration) setPreviewCard(active ? card : undefined);
    }, 120);
    onCleanup(() => clearTimeout(timer));
  });

  /** The carousel line: where the poster shelves start, and therefore where the
   * hero band ends. */
  const shelfTitleY = () => {
    const rows = options.home()?.rows ?? [];
    const id = rows[Math.min(options.row(), Math.max(0, rows.length - 1))]?.id;
    return options.zone() === "rows"
      ? id === "continue" ? CAROUSEL_TOP.continue : CAROUSEL_TOP.portrait
      : CAROUSEL_TOP.hero;
  };

  /** The card the hero should describe right now. */
  const hero = createMemo(() => {
    const value =
      options.screen() === "home"
        ? options.zone() === "rows"
          ? (previewCard() ?? options.home()?.hero)
          : (options.home()?.featured[heroCycle.slide()] ?? options.home()?.hero)
        : options.detail()?.item;
    if (!value || value.logo || options.screen() !== "home") return value;
    // The featured carousel's cards can be summary-only while the same title in
    // a row carries the logo. Borrow that artwork so Home never shows the title
    // fallback for a title that already has one.
    const identity = presentationKey(value);
    for (const row of options.home()?.rows ?? []) {
      const match = row.cards.find((card) => presentationKey(card) === identity);
      if (match?.logo)
        return { ...value, logo: match.logo, landscape: value.landscape ?? match.landscape, poster: value.poster ?? match.poster };
    }
    const fallback = options.home()?.hero;
    if (fallback && presentationKey(fallback) === identity && fallback.logo) return { ...value, logo: fallback.logo };
    return value;
  });

  const heroLogoBox = () => options.screen() === "detail"
    ? detailLogoBox(options.detailHasEpisodes(), compactDetail(options.zone()))
    : homeLogoBox(options.zone() === "rows" ? shelfTitleY() : undefined);
  const heroMode = (): HeroMode =>
    options.screen() === "detail" ? "detail"
      : options.zone() !== "rows" ? "hero"
        : options.home()?.rows[options.row()]?.id === "continue" ? "landscape" : "portrait";
  const heroPresentation = createCoherentHero(
    () => !options.screenSaver() && (options.screen() === "home" || options.screen() === "detail") ? hero() ?? undefined : undefined,
    () => `${options.deviceScope()}:${options.screen()}`,
    heroMode,
    heroLogoBox,
    shelfTitleY,
    () => heroCycle.visible() && (options.screen() !== "home" || options.zone() !== "rows" ||
      !!previewCard() && !!options.focusedCard() && presentationKey(previewCard()!) === presentationKey(options.focusedCard()!)),
  );
  const displayHero = heroPresentation.card;
  const displayedFeatured = createMemo(() => {
    const card = displayHero();
    return card ? (options.home()?.featured ?? []).findIndex(value => cardKey(value) === cardKey(card)) : -1;
  });
  const heroIntentCard = () => (options.screen() === "home" ? displayHero() : hero());
  const interruptHero = () => {
    if (options.screen() !== "home" && !options.screenSaver()) return;
    heroCycle.interrupt(displayedFeatured());
  };
  createEffect(() => {
    if (options.screenSaver() || options.screen() !== "home" || options.zone() !== "rows") {
      heroCycle.setReady(heroCycle.visible());
      return;
    }
    const shown = displayHero(), requested = hero();
    heroCycle.setReady(heroCycle.visible() && !!shown && !!requested &&
      presentationKey(shown) === presentationKey(requested) &&
      !heroPresentation.frames().some(frame => frame.staged));
  });
  /** The detail item, once its own artwork is the prepared one. */
  const detailForDisplay = createMemo(() =>
    options.detail() && displayHero() && presentationKey(options.detail()!.item) === presentationKey(displayHero()!)
      ? { ...options.detail()!, item: displayHero()! }
      : undefined);
  const billboardKey = createMemo(() =>
    options.screen() === "home" && !options.screenSaver() && options.zone() !== "rows" && hero()
      ? cardKey(hero()!)
      : undefined);
  createEffect(() => {
    // A new featured title is a new pass: the bar restarts from full.
    billboardKey();
    heroCycle.reset();
  });
  let heroOrder = "";
  createEffect(() => {
    // A new featured order is new presentation: present it as a fresh pass. A
    // server refresh that repeats the same order must not restart anything.
    const order = (options.home()?.featured ?? []).map(cardKey).join("|");
    if (!order || order === heroOrder) return;
    heroOrder = order;
    heroCycle.restart();
  });
  /** Keep the focused shelf card's column when a row comes back. */
  const rememberHomeRow = () => {
    if (options.screen() === "home" && options.zone() === "rows")
      options.rowFocus.remember(options.home()?.rows[options.row()], options.column());
  };
  /** A server refresh keeps the pass unless the featured list changed. */
  const clampCycle = () => heroCycle.clamp(options.home()?.featured.length ?? 0);
  /** A new profile: no preview, no pass, no featured title. */
  function reset() {
    setPreviewCard(undefined);
    heroCycle.clear();
  }
  return {
    reset,
    heroCycle, heroSlide: heroCycle.slide, previewCard, setPreviewCard, shelfTitleY, hero, heroLogoBox, heroMode,
    heroPresentation, displayHero, displayedFeatured, heroIntentCard, interruptHero, detailForDisplay,
    clampCycle, rememberHomeRow, restartHeroCycling: heroCycle.restart, resetHeroCycle: heroCycle.reset,
    setHeroVisible: heroCycle.setVisible, clearCycle: heroCycle.clear, rowFocus: options.rowFocus, batch,
  };
}
