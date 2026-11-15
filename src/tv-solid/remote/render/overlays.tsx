/** @jsxImportSource @solidtv/solid */
import { Show, type JSX } from "solid-js";
import { TvView } from "../../runtime";
import { Label, palette } from "../visuals";
import { OverlayViewport } from "../OverlayViewport";
import { PlaybackPreparation } from "../PlaybackPreparation";
import { StatusDialog } from "../StatusDialog";
import { PosterWall } from "../PosterWall";
import { SlidingDrawer } from "../SlidingDrawer";
import { SourceActionsPanel } from "../source-picker/SourceActionsPanel";
import { SourceFilters } from "../source-picker/SourceFilters";
import { SourceFooter } from "../source-picker/SourceFooter";
import { SourceHeading } from "../source-picker/SourceHeading";
import { SourceList } from "../source-picker/SourceList";
import { SourceOptionsMenu } from "../source-picker/SourceOptionsMenu";
import { ChoiceDrawer } from "../ChoiceDrawer";
import { ProfileEditorView } from "../ProfileEditorView";
import { TracksDrawer } from "../TracksDrawer";
import { TextEntryPanel } from "../TextEntryPanel";
import { NextEpisodePanel } from "../NextEpisodePanel";
import { CalibrationPanel } from "../CalibrationPanel";
import { sourceEmptyCopy, sourceStatusCopy } from "../sourceStatus";
import type { Overlay } from "../app-types";
import type { Card, Management, Source, SourcePage } from "../types";
import type { SourceMenuOption } from "../source-picker/options";
import type { SourcePickerSpread } from "../sourceStatus";

/** Everything above the app chrome: the modal drawer, the preparation screen,
 * the error card, the toast, and the idle saver.
 *
 * They are one component because they share a single rule — exactly one of them
 * may be the thing the viewer is looking at — and because the drawer needs the
 * same source picker state the app's input handler owns. Nothing here decides
 * anything; it draws what the state already says. */
export function AppOverlays(props: {
  screen: string;
  openingSource: boolean;
  overlay: Overlay | undefined;
  entered: boolean;
  closing: boolean;
  settled: (state: "open" | "closed") => void;
  sourceLoading: boolean;
  pickerCard: Card | undefined;
  sources: Source[];
  visibleSources: Source[];
  sourcePage: SourcePage | undefined;
  sourceAddonCount: number;
  sourceMenu: "quality" | "provider" | undefined;
  sourceMenuOptions: SourceMenuOption[];
  sourceMenuChoice: number;
  sourceHeight: number | undefined;
  sourceProviderFilter: string | undefined;
  sourceActions: boolean;
  sourceActionChoice: number;
  focusedSource: Source | undefined;
  sourceFilterFocus: boolean;
  sourceFacet: number;
  sourceFailure: string;
  sourceSpread: SourcePickerSpread;
  sourceQualityValue: string;
  sourceProviderValue: string;
  failedSources: ReadonlySet<string>;
  choice: number;
  profileEditor: Extract<Overlay, { kind: "choices" | "confirm" }> | undefined;
  management: Management | undefined;
  trackColumn: number;
  text: string;
  keyboard: (modal: boolean) => JSX.Element;
  activeAction: { card: Card } | undefined;
  episode: Parameters<typeof NextEpisodePanel>[0]["episode"];
  countdown: Parameters<typeof NextEpisodePanel>[0]["countdown"];
  calibration: Parameters<typeof CalibrationPanel>[0]["value"];
  error: string;
  notice: string;
  pending: boolean;
  paletteBg: string;
}) {
  const editor = () => props.profileEditor;
  return <>
    <Show when={!props.openingSource ? props.overlay : undefined}>
      {(modal) => (
        <OverlayViewport order={10} shade={modal().kind !== "next" ? "rgba(0,0,0,.6)" : undefined} shadeWidth={1920}>
          <Show when={modal().kind === "next"}>
            <NextEpisodePanel currentTitle={props.activeAction?.card.title ?? "Episode"} episode={props.episode}
              countdown={props.countdown} selected={props.choice} entered={props.entered} />
          </Show>
          <Show when={modal().kind === "calibration"}>
            <CalibrationPanel title={modal().title} value={props.calibration} />
          </Show>
          <Show when={modal().kind === "sources"}>
            <SlidingDrawer width={960} entered={props.entered} closing={props.closing} onSettled={props.settled}>
              <SourceHeading title={props.pickerCard?.title ?? ""} checking={props.sourceLoading && !props.sources.length}
                count={props.sourcePage?.total ?? props.sources.length} addons={props.sourceAddonCount} />
              <Show when={!props.sourceMenu && !props.sourceActions}>
                <SourceFilters quality={props.sourceQualityValue} provider={props.sourceProviderValue}
                  focused={props.sourceFilterFocus ? props.sourceFacet : undefined} />
                <SourceList sources={props.visibleSources} selected={props.choice} focused={!props.sourceFilterFocus}
                  bestMatch={props.sourcePage?.best_match_id ?? undefined} failed={props.failedSources} />
              </Show>
              <Show when={props.sourceMenu}>
                <SourceOptionsMenu kind={props.sourceMenu!} options={props.sourceMenuOptions} selected={props.sourceMenuChoice}
                  matches={option => props.sourceMenu === "quality" ? option.height === props.sourceHeight : option.provider === props.sourceProviderFilter} />
              </Show>
              <Show when={props.sourceActions}>
                <SourceActionsPanel source={props.focusedSource} selected={props.sourceActionChoice} />
              </Show>
              <SourceFooter empty={sourceEmptyCopy(props.sourceSpread)} status={sourceStatusCopy(props.sourceSpread)}
                failure={props.sourceFailure}
                filtered={!sourceEmptyCopy(props.sourceSpread) && props.sources.length > 0 && props.visibleSources.length === 0} />
            </SlidingDrawer>
          </Show>
          <Show when={(modal().kind === "choices" || modal().kind === "confirm") && !editor()}>
            <ChoiceDrawer dialog={modal() as Extract<Overlay, { kind: "choices" | "confirm" }>} selected={props.choice}
              entered={props.entered} closing={props.closing} onSettled={props.settled} />
          </Show>
          <Show when={editor()}>
            {(value) => (
              <ProfileEditorView profile={props.management?.profiles.find(profile => profile.id === value().profile!.id) ?? value().profile!}
                items={value().items} selected={props.choice} />
            )}
          </Show>
          <Show when={modal().kind === "tracks"}>
            <TracksDrawer columns={(modal() as Extract<Overlay, { kind: "tracks" }>).columns}
              column={props.trackColumn} selected={props.choice} />
          </Show>
          <Show when={modal().kind === "text"}>
            <TextEntryPanel title={modal().title} numeric={!!(modal() as Extract<Overlay, { kind: "text" }>).numeric}
              secret={!!(modal() as Extract<Overlay, { kind: "text" }>).secret} text={props.text}>
              {props.keyboard(true)}
            </TextEntryPanel>
          </Show>
        </OverlayViewport>
      )}
    </Show>
    <Show when={(props.openingSource || props.sourceLoading && !props.overlay && props.screen !== "player") && !props.error}>
      <OverlayViewport order={15} shade={props.paletteBg} shadeWidth={1920}>
        <PlaybackPreparation card={props.pickerCard} />
      </OverlayViewport>
    </Show>
    <Show when={props.error}>
      <OverlayViewport order={20} shade="rgba(0,0,0,.55)">
        <StatusDialog title="Couldn’t continue" message={props.error}
          action={props.screen === "player" ? "Choose a source" : "Try again"} />
      </OverlayViewport>
    </Show>
    <Show when={props.notice || props.pending}>
      <TvView x={560} y={960} w={800} h={72} color={palette.surface}>
        <Label w={800} centerY={36} align="center" size={24}
          content={props.pending ? (props.screen === "settings" || editor() ? "Saving…" : "Loading…") : props.notice} />
      </TvView>
    </Show>
  </>;
}

/** The idle saver: the welcome wall with the featured artwork rotating through
 * its cells. It sits outside the page's own visibility toggle, so the wall is
 * the only thing on screen while it runs. */
export function IdleSaver(props: { active: boolean; featured: Card[] | undefined; slide: number }) {
  return (
    <Show when={props.active}>
      <OverlayViewport order={40}>
        <PosterWall featured={props.featured} slide={props.slide} />
        <TvView w={1920} h={1080} color="rgba(11,11,12,.72)" />
      </OverlayViewport>
    </Show>
  );
}
