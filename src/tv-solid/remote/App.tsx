/** @jsxImportSource @solidtv/solid */
import {



  For,



  Show,



  batch,



  createEffect,



  createMemo,



  createSignal,



  onCleanup,



  onMount


} from "solid-js";
import QRCode from "qrcode";
import {


 EntryScreen 


} from "./EntryScreens";
import {


 PairingScreen 


} from "./PairingScreen";
import {


 ProfilesScreen 


} from "./ProfilesScreen";
import {


 SignedIn 


} from "./SignedIn";
import {


 PosterWall 


} from "./PosterWall";
import {


 LibraryToolbar 


} from "./LibraryToolbar";
import {


 SearchInput,


 searchLetters 


} from "./SearchInput";
import {


 SearchChannels 


} from "./SearchChannels";
import {



  channelKey,



  edgeRequest,



  joinChannelWindow,



  pageRequest,



  samePageRequest,



  type PageDirection


} from "./channelWindow";
import {


 TitleMetadata as Metadata 


} from "./TitleMetadata";
import {


 BrowseBackdrop,


 BrowsePreview 


} from "./BrowsePreview";
import {


 HomeProgress,


 TilePlay 


} from "./HomeTileEffects";
import {



  createBillboardArt,



  BillboardBackdrop,



  BillboardButton,



  HeroProgress


} from "./Billboard";
import {


 defineScreen,


 TvView,


 KeyedFor 


} from "../runtime";
import {


 exitWebos 


} from "../webos";
import {



  Backdrop,



  Button,



  Label,



  Logo,



  icon,



  palette,



  avatar,



  cardOutline,



  navIcon,



  outline


} from "./visuals";
import {



  RemoteTvApi,



  lookupSelector,



  RemoteError,



  delay,



  query,



  segment


} from "./api";
import {


 RemotePlayback 


} from "./playback";
import {


  applyDisplayPreferences,


  applyScreenInset,


  defaultDisplayPreferences,


  screenSaverMinutes

} from "./display";
import {



  cardKey,



  type Bootstrap,



  type Card,



  type Catalog,



  type Channel,



  type Control,



  type Controls,



  type Detail,



  type DisplayPreferences,



  type Home,



  type LibraryPage,



  type LibraryQuery,



  type LivePage,



  type Management,



  type Page,



  type Pairing,



  type Preferences,



  type Profile,



  type Program,



  type Guide,



  type Source,



  type SourcePage,



  type TitleAction


} from "./types";
import type { PlayerSnapshot } from "../../../vendor/video/src/types";

type Screen =
  | "welcome"
  | "pairing"
  | "signed-in"
  | "profiles"
  | "home"
  | "movie"
  | "series"
  | "search"
  | "live"
  | "library"
  | "detail"
  | "settings"
  | "player";
interface IntegrationSchema {
  plugin_id: string;
  name: string;
  state: string;
  runtime_enabled: boolean;
  credential_fields: {
    id: string;
    label: string;
    secret: boolean;
    required: boolean;
  }[];
  connection_id?: string;
  provider_choices: { id: string; label: string }[];
  maximum_providers: number;
  saved_provider_count?: number;
}
type Item = {
  id: string;
  label: string;
  value?: string;
  description?: string;
  run: () => void | Promise<void>;
  /** Inline left/right adjustment for display rows (swatches, toggles). */
  cycle?: (direction: number) => void | Promise<void>;
  /** Boolean display rows render the reference toggle instead of a value. */
  toggle?: boolean;
  /** Accent rows render the palette swatches; value is the current hex. */
  swatches?: string[];
  /** Rows opening a value picker carry the boards' trailing chevron. */
  chevron?: boolean;
};
type Overlay =
  | {
      kind: "choices" | "confirm";
      title: string;
      description?: string;
      items: Item[];
      profile?: Profile;
    }
  | {
      kind: "calibration";
      title: string;
      min: number;
      max: number;
      value: number;
      save: (value: number) => void | Promise<void>;
    }
  | {
      kind: "text";
      title: string;
      secret?: boolean;
      numeric?: boolean;
      initial?: string;
      submit: (value: string) => Promise<void>;
    }
  | { kind: "sources"; title: string }
  | {
      kind: "tracks";
      title: string;
      columns: { title: string; items: Item[] }[];
    };
const available = (value?: { availability: string }) =>
  value?.availability === "Available";
const sourceLabelWidth = (label: string) => {
  const context = document.createElement("canvas").getContext("2d")!;
  context.font = "27px Onest700";
  return Math.min(300, Math.ceil(context.measureText(label).width));
};
const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
const navigationTemplates = [
  { id: "search", label: "" },
  { id: "home", label: "Home" },
  { id: "movie", label: "Movies" },
  { id: "series", label: "Series" },
  { id: "live", label: "Live" },
  { id: "library", label: "My List" },
  { id: "profiles", label: "Profile" },
] as const;
type NavId = (typeof navigationTemplates)[number]["id"];
type NavigationItem = {
  id: NavId;
  label: string;
  media_search?: boolean;
  channel_search?: boolean;
};

const letters = "abcdefghijklmnopqrstuvwxyz1234567890@./:_-".split("");
const symbols = [
  "@",
  ".",
  "/",
  ":",
  "_",
  "-",
  "?",
  "=",
  "&",
  "%",
  "+",
  "#",
  "[",
  "]",
  "!",
  "$",
  "(",
  ")",
  "*",
  "~",
  ",",
  ";",
  "\\",
  "'",
  '"',
  "|",
  "^",
  "{",
  "}",
  "<",
  ">",
  "`",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "0",
];

export function createRemoteTvApp(api: RemoteTvApi, platform: string) {
  return () => {
    const [screen, setScreen] = createSignal<Screen>("welcome"),
      [home, setHome] = createSignal<Home>(),
      [management, setManagement] = createSignal<Management>(),
      [navigation, setNavigation] = createSignal<Bootstrap["navigation"]>(),
      [library, setLibrary] = createSignal<LibraryPage>(),
      [preferencesSignal, setPreferencesSignal] = createSignal<Preferences>();
    /** Server preference snapshots drive the display settings immediately;
     * clearing the profile restores the designed defaults. */
    const adoptPreferences = (value: Preferences | undefined) => {
      setPreferencesSignal(value);
      applyDisplayPreferences(value?.display ?? defaultDisplayPreferences);
    };
    const preferences = preferencesSignal;
    const setPreferences = adoptPreferences;
    const navs = createMemo<NavigationItem[]>(() =>
      (
        navigation() ??
        navigationTemplates.filter(
          (item) => item.id === "home" || item.id === "profiles",
        )
      ).flatMap((item) => {
        const supported = navigationTemplates.find(
          (template) => template.id === item.id,
        );
        return supported ? [{ ...item, id: supported.id }] : [];
      }),
    );
    const navIndex = (id: string) =>
      Math.max(
        0,
        navs().findIndex((item) => item.id === id),
      );
    const canManageProfiles = () =>
      !!management()?.profiles.length &&
      ["rename", "avatar", "delete"].some((key) =>
        available(management()?.capabilities[key]),
      );
    const searchCapabilities = createMemo(() => {
      const entry = navs().find((item) => item.id === "search");
      return {
        media: !!entry && entry.media_search !== false,
        channels: entry?.channel_search === true,
      };
    });
    const [loading, setLoading] = createSignal(true),
      [error, setError] = createSignal(""),
      [playbackError, setPlaybackError] = createSignal(""),
      [pending, setPending] = createSignal(false);
    const [zone, setZone] = createSignal("nav"),
      [column, setColumn] = createSignal(1),
      [row, setRow] = createSignal(0),
      [heroAction, setHeroAction] = createSignal(0);
    const [detailAction, setDetailAction] = createSignal<TitleAction>();
    const [seasonIndex, setSeasonIndex] = createSignal(0);
    const [detail, setDetail] = createSignal<Detail>(),
      [selected, setSelected] = createSignal<Card>(),
      [page, setPage] = createSignal<Page>({ cards: [], complete: true }),
      [controls, setControls] = createSignal<Controls>(),
      [catalog, setCatalog] = createSignal<Catalog>(),
      [filters, setFilters] = createSignal<Record<string, string[]>>({});
    const [liveFavorites, setLiveFavorites] = createSignal<Set<string>>();
    const [livePages, setLivePages] = createSignal<LivePage[]>([]),
      [channels, setChannels] = createSignal<Channel[]>([]),
      [liveSnapshot, setLiveSnapshot] = createSignal(""),
      [groups, setGroups] = createSignal<{ id: string; label: string }[]>([]),
      [liveGroup, setLiveGroup] = createSignal<string>(),
      [programs, setPrograms] = createSignal<Record<string, Program[]>>({});
    const [guideInfo, setGuideInfo] = createSignal<
        Record<string, Guide["view"]>
      >({}),
      [programIndex, setProgramIndex] = createSignal(0);
    const liveChannelIndex = () => (zone() === "live-groups" ? 0 : column());
    const guideRowStart = () =>
      edgeRequest(livePages(), "previous")
        ? liveChannelIndex() - 2
        : Math.max(0, liveChannelIndex() - 2);
    const liveGroupStart = createMemo(() => {
      const focused =
        zone() === "live-groups"
          ? column()
          : groups().findIndex((group) => group.id === liveGroup()) + 1;
      return Math.max(0, Math.min(groups().length - 8, focused - 4));
    });
    const currentGuide = createMemo(
      () => guideInfo()[channels()[liveChannelIndex()]?.id],
    );
    const currentProgram = createMemo(
      () => programs()[channels()[liveChannelIndex()]?.id]?.[programIndex()],
    );
    const guideStart = createMemo(() => {
      const base = currentGuide()?.window_start_millis ?? 0;
      const selected = currentProgram();
      return selected &&
        (selected.start_millis < base ||
          selected.start_millis >= base + 7200000)
        ? Math.floor(selected.start_millis / 1800000) * 1800000
        : base;
    });
    // Reuse ICU's locale formatter while navigating the guide. Constructing it
    // for every visible time label dominated the guide's sampled JS work.
    let guideClock: Intl.DateTimeFormat | undefined;
    const guideTime = (at: number) => {
      const date = new Date(at);
      if (!Number.isFinite(date.getTime())) return date.toLocaleTimeString();
      guideClock ??= new Intl.DateTimeFormat([], {
        hour: "numeric",
        minute: "2-digit",
      });
      return guideClock.format(date);
    };
    const [search, setSearch] = createSignal(""),
      [searchError, setSearchError] = createSignal(""),
      [searchChannelError, setSearchChannelError] = createSignal(""),
      [searchMediaPending, setSearchMediaPending] = createSignal(false),
      [searchChannelsPending, setSearchChannelsPending] = createSignal(false),
      [searchChannelPaging, setSearchChannelPaging] = createSignal(false),
      [searchChannels, setSearchChannels] = createSignal<Channel[]>([]),
      [searchChannelPages, setSearchChannelPages] = createSignal<LivePage[]>(
        [],
      ),
      [pairing, setPairing] = createSignal<Pairing>(),
      [pairingDeadline, setPairingDeadline] = createSignal(0),
      [pairingFocused, setPairingFocused] = createSignal(false),
      [signedIn, setSignedIn] = createSignal<Bootstrap>(),
      [qr, setQr] = createSignal("");
    const [keyboardUpper, setKeyboardUpper] = createSignal(false),
      [keyboardSymbols, setKeyboardSymbols] = createSignal(false);
    const keyboardCharacters = createMemo(() =>
      keyboardSymbols()
        ? symbols
        : letters.map((letter) =>
            keyboardUpper() ? letter.toUpperCase() : letter,
          ),
    );
    const [trackColumn, setTrackColumn] = createSignal(0);
    const [overlayEntered, setOverlayEntered] = createSignal(false),
      [overlayClosing, setOverlayClosing] = createSignal(false),
      [accountEmail, setAccountEmail] = createSignal(""),
      [overlaySettled, setOverlaySettled] = createSignal(false);
    const overlayParents: { value: Overlay; choice: number }[] = [];
    const [calibrationValue, setCalibrationValue] = createSignal(0);
    /** Server-owned screen saver: after the profile's idle minutes with
     * nothing playing, dim to slow-moving art. The wake key is swallowed. */
    const [screenSaver, setScreenSaver] = createSignal(false);
    let lastActivity = Date.now();
    const screenSaverTimer = setInterval(() => {
      const minutes = screenSaverMinutes();
      if (!minutes || screenSaver() || screen() === "player") return;
      if (Date.now() - lastActivity >= minutes * 60_000) setScreenSaver(true);
    }, 15_000);
    onCleanup(() => clearInterval(screenSaverTimer));
    /** Returns true when a key woke the saver, swallowing that key press. */
    function dismissScreenSaver(): boolean {
      if (screenSaver()) {
        setScreenSaver(false);
        lastActivity = Date.now();
        return true;
      }
      lastActivity = Date.now();
      return false;
    }
    let overlayFrame = 0,
      overlayTimer: ReturnType<typeof setTimeout> | undefined;

    const [overlay, setOverlay] = createSignal<Overlay>(),
      [choice, setChoice] = createSignal(0),
      [text, setText] = createSignal(""),
      [key, setKey] = createSignal(0);
    const [sourcePage, setSourcePage] = createSignal<SourcePage>(),
      [allSourceIds, setAllSourceIds] = createSignal<string[]>([]),
      [sourceFacet, setSourceFacet] = createSignal(0),
      [sourceFilterFocus, setSourceFilterFocus] = createSignal(false);
    const profileEditor = createMemo(() => {
      const value = overlay();
      return value &&
        (value.kind === "choices" || value.kind === "confirm") &&
        value.profile
        ? value
        : undefined;
    });
    const [sourceHeight, setSourceHeight] = createSignal<number>(),
      [sourceFiltering, setSourceFiltering] = createSignal(false);
    let manualSourceSelection = false,
      sourceFilterGeneration = 0,
      holdTimer: ReturnType<typeof setTimeout> | undefined;
    const [sources, setSources] = createSignal<Source[]>([]),
      [sourceLoading, setSourceLoading] = createSignal(false),
      [action, setAction] = createSignal<TitleAction>(),
      [activeAction, setActiveAction] = createSignal<TitleAction>(),
      [pickerCard, setPickerCard] = createSignal<Card>(),
      [sourceChannel, setSourceChannel] = createSignal<string>(),
      [replacingSource, setReplacingSource] = createSignal(false),
      [activeChannel, setActiveChannel] = createSignal<string>(),
      [activeSource, setActiveSource] = createSignal<Source>();
    const [snapshot, setSnapshot] = createSignal<PlayerSnapshot>(),
      [showControls, setShowControls] = createSignal(true),
      [seek, setSeek] = createSignal<number>(),
      [settingsTab, setSettingsTab] = createSignal(0),
      [settingsItems, setSettingsItems] = createSignal<Item[]>([]),
      [notice, setNotice] = createSignal("");
    const [captionOverride, setCaptionOverride] = createSignal<{
      leaseId: string;
      appearance: {
        font_scale: number;
        text_color: string;
        background_color: string;
      };
    }>();
    const [saved, setSaved] = createSignal<Map<string, boolean>>(new Map());
    const isSaved = (card: Card) =>
      saved().get(cardKey(card)) ?? card.view?.saved ?? false;
    createEffect(() => {
      if (screen() !== "profiles") return;
      const count =
        (management()?.profiles.length ?? 0) +
        (available(management()?.capabilities.create) ? 1 : 0);
      setColumn((i) => Math.max(0, Math.min(i, count - 1)));
      if (zone() === "profile-manage" && !canManageProfiles())
        setZone("profiles");
    });
    let scope = new AbortController(),
      settingsScope: AbortController | undefined,
      pagingScope: AbortController | undefined,
      sourceScope: AbortController | undefined,
      searchScope: AbortController | undefined,
      alive = true,
      revisionTimer: ReturnType<typeof setTimeout> | undefined,
      noticeTimer: ReturnType<typeof setTimeout> | undefined,
      searchTimer: ReturnType<typeof setTimeout> | undefined,
      controlsTimer: ReturnType<typeof setTimeout> | undefined;
    let retry: () => void = () => void start(),
      returnScreen: Screen = "home",
      returnFocus = { zone: "hero", column: 0, row: 0 },
      overlayFocus = { zone: "hero", column: 0, row: 0, choice: 0 },
      lastRevisions = "",
      searchMediaFocus = 0,
      searchChannelFocus = 0,
      pageBusy = false,
      pageGeneration = 0;
    let channelPending: { from: string; direction: PageDirection } | undefined;
    let channelRetry: PageDirection | undefined;
    function adoptChannelWindow(pages: LivePage[], searching = false) {
      const values = pages.flatMap((page) => page.channels);
      if (searching) {
        setSearchChannelPages(pages);
        setSearchChannels(values);
        return;
      }
      setLivePages(pages);
      // Channels accumulate for global focus; only the guide windows stay
      // bounded. A reset (empty window) clears the accumulation. A refresh that
      // returns the same channel ids adopts their new server data in place, and
      // genuinely new channels append for cross-page focus.
      setChannels((current) => {
        if (!pages.length) return [];
        const byId = new Map(values.map((channel) => [channelKey(channel), channel]));
        const seen = new Set(current.map(channelKey));
        const merged = current.map((channel) => byId.get(channelKey(channel)) ?? channel);
        const fresh = values.filter((channel) => !seen.has(channelKey(channel)));
        return [...merged, ...fresh];
      });
      setPage({
        cards: channels().map((channel) => channel.card),
        complete: pages.at(-1)?.complete ?? true,
      });
    }
    let pendingFocus:
      | {
          screen: Screen;
          zone: string;
          row: number;
          from: number;
          index: number;
          generation: number;
        }
      | undefined;
    function pageSignal() {
      if (!pagingScope || pagingScope.signal.aborted) {
        const owner = scope,
          request = new AbortController();
        const cancel = () => request.abort();
        owner.signal.addEventListener("abort", cancel, { once: true });
        request.signal.addEventListener(
          "abort",
          () => owner.signal.removeEventListener("abort", cancel),
          { once: true },
        );
        if (owner.signal.aborted) request.abort();
        pagingScope = request;
      }
      return pagingScope.signal;
    }
    function restartPaging() {
      pagingScope?.abort();
      pagingScope = undefined;
      pageGeneration++;
      pageBusy = false;
      pendingFocus = undefined;
      channelPending = undefined;
      channelRetry = undefined;
      return pageSignal();
    }
    function moveToItem(
      index: number,
      length: number,
      nextCursor?: string | null,
    ) {
      if (index >= length && nextCursor) {
        pendingFocus = {
          screen: screen(),
          zone: zone(),
          row: row(),
          from: column(),
          index,
          generation: pageGeneration,
        };
      } else setColumn(Math.max(0, Math.min(length - 1, index)));
    }
    function settlePendingFocus() {
      const pending = pendingFocus;
      if (
        !pending ||
        pending.generation !== pageGeneration ||
        pending.screen !== screen() ||
        pending.zone !== zone() ||
        pending.row !== row() ||
        pending.from !== column()
      )
        return;
      const shelf = screen() === "home" ? home()?.rows[row()] : undefined;
      const length =
        screen() === "search" && zone() === "search-channels"
          ? searchChannels().length
          : screen() === "live"
            ? channels().length
            : screen() === "detail"
              ? (detail()?.episodes.length ?? 0)
              : shelf
                ? shelf.cards.length
                : page().cards.length;
      const next =
        screen() === "search" && zone() === "search-channels"
          ? edgeRequest(searchChannelPages(), "next")?.cursor
          : screen() === "detail"
            ? detail()?.next_cursor
            : shelf
              ? shelf.next_cursor
              : page().next_cursor;
      if (pending.index < length || !next) {
        pendingFocus = undefined;
        setColumn(Math.max(0, Math.min(length - 1, pending.index)));
        if (screen() === "live") void loadVisibleGuides();
      } else if (!pageBusy) {
        if (shelf) void loadHomePage();
        else void more();
      }
    }
    const history: {
      screen: Screen;
      zone: string;
      column: number;
      row: number;
      selected?: Card;
      detail?: Detail;
      detailAction?: TitleAction;
      seasonIndex: number;
      page?: Page;
      focusKey?: string;
      rowId?: string;
      stale?: boolean;
    }[] = [];
    const call = <T,>(
      path: string,
      method = "GET",
      body?: unknown,
      signal: AbortSignal = scope.signal,
    ) => api.call<T>(path, method, body, signal);
    const player = new RemotePlayback(
      api,
      platform,
      document.getElementById("tv-video") as HTMLVideoElement,
      setSnapshot,
      (e) => {
        fail(e);
        setShowControls(true);
      },
    );
    const playerActions = createMemo(() => {
      snapshot();
      return player.actions;
    });
    const playerButtons = createMemo(() => {
      snapshot();
      return [
        {
          id:
            playerActions().pause || playerActions().seek
              ? "timeline"
              : "status",
          label: "",
        },
        ...(playerActions().episodes
          ? [{ id: "episodes", label: "Episodes" }]
          : []),
        ...(playerActions().tracks
          ? [{ id: "tracks", label: "Audio & subtitles" }]
          : []),
        ...(playerActions().change_source
          ? [{ id: "sources", label: "Source" }]
          : []),
        ...(playerActions().next_episode
          ? [{ id: "next", label: "Next episode" }]
          : []),
      ];
    });
    createEffect(() => {
      const count = playerButtons().length;
      if (screen() === "player" && !overlay() && choice() >= count)
        setChoice(Math.max(0, count - 1));
      if (!playerActions().seek) setSeek(undefined);
    });
    function openTracks() {
      setTrackColumn(0);
      openOverlay({
        kind: "tracks",
        title: "Audio & subtitles",
        columns: [
          {
            title: "Audio",
            items: player.tracks.audio
              .filter(
                (track) =>
                  track.selectable === true && track.supported !== false,
              )
              .map((track) => ({
                id: `audio-${track.input_index}`,
                label: track.title ?? track.language ?? "Audio",
                value: track.selected ? "✓" : "",
                run: async () => {
                  await player.selectTrack("audio", track.input_index);
                  closeOverlay();
                },
              })),
          },
          {
            title: "Subtitles",
            items: [
              ...(player.tracks.subtitlesSupported
                ? [
                    {
                      id: "off",
                      label: "Off",
                      run: async () => {
                        await player.selectTrack("text", null);
                        closeOverlay();
                      },
                    },
                  ]
                : []),
              ...player.tracks.text
                .filter(
                  (track) =>
                    track.selectable === true && track.supported !== false,
                )
                .map((track) => ({
                  id: `text-${track.input_index}`,
                  label: track.title ?? track.language ?? "Subtitle",
                  value: track.selected ? "✓" : "",
                  run: async () => {
                    await player.selectTrack("text", track.input_index);
                    closeOverlay();
                  },
                })),
            ],
          },
          ...(playerActions().subtitle_style
            ? [
                {
                  title: "Subtitle size",
                  items: (
                    preferences()?.controls?.find(
                      (control) => control.id === "subtitle_font_scale",
                    )?.choices ?? []
                  ).map((option) => ({
                    id: String(option.value),
                    label: option.label,
                    value:
                      preferences()?.preferences.subtitle_font_scale ===
                      option.value
                        ? "✓"
                        : "",
                    run: async () => {
                      const previous = preferences()!;
                      const leaseId = player.leaseId;
                      const receipt = await call<Preferences>(
                        api.scoped("/preferences"),
                        "PUT",
                        {
                          revision: previous.revision,
                          preferences: {
                            ...previous.preferences,
                            subtitle_font_scale: option.value,
                          },
                        },
                      );
                      setPreferences(receipt);
                      const p = receipt.preferences;
                      if (
                        leaseId &&
                        player.leaseId === leaseId &&
                        typeof p.subtitle_font_scale === "number" &&
                        typeof p.subtitle_text_color === "string" &&
                        typeof p.subtitle_background_color === "string"
                      ) {
                        setCaptionOverride({
                          leaseId,
                          appearance: {
                            font_scale: p.subtitle_font_scale,
                            text_color: p.subtitle_text_color,
                            background_color: p.subtitle_background_color,
                          },
                        });
                      }
                      closeOverlay();
                    },
                  })),
                },
              ]
            : []),
        ].filter((column) => column.items.length),
      });
      const modal = overlay();
      if (modal?.kind === "tracks")
        setChoice(
          Math.max(
            0,
            modal.columns[0]?.items.findIndex((item) => item.value === "✓") ??
              0,
          ),
        );
    }
    const navLayout = createMemo(() => {
      const context = document.createElement("canvas").getContext("2d")!;
      let x = 300;
      return navs().map((nav) => {
        if (nav.id === "profiles") return { x: 1768, w: 56 };
        context.font = `26px ${screen() === nav.id ? "Onest700" : "Onest500"}`;
        const w =
          nav.id === "search"
            ? 56
            : Math.ceil(context.measureText(nav.label).width) + 36;
        const box = { x, w };
        x += w + 8;
        return box;
      });
    });
    const sceneWidth = createMemo(() => {
      const value = overlay();
      if (!overlaySettled() || overlayClosing() || !value) return 1920;
      if (value.kind === "sources") return 960;
      if (
        (value.kind === "choices" || value.kind === "confirm") &&
        !value.profile
      )
        return 1100;
      return 1920;
    });
    const notify = (message: string) => {
      setNotice(message);
      clearTimeout(noticeTimer);
      noticeTimer = setTimeout(() => setNotice(""), 3500);
    };
    const fail = (e: unknown) => {
      if (!alive || (e instanceof DOMException && e.name === "AbortError"))
        return;
      if (e instanceof RemoteError && e.status === 401) {
        clearTimeout(revisionTimer);
        api.retireProfile();
        resetScope();
        void player.stop().catch(() => {});
        clearProfileView();
        setScreen("welcome");
        retry = () => void start();
      }
      setError(e instanceof Error ? e.message : "Couldn’t load. Try again.");
      if (
        screen() === "player" &&
        !["playing", "paused"].includes(snapshot()?.state ?? "")
      )
        setPlaybackError(error());
      setLoading(false);
    };
    const run = async (work: () => Promise<void>) => {
      if (pending() || overlayClosing()) return;
      setPending(true);
      setError("");
      retry = () => void run(work);
      try {
        await work();
      } catch (e) {
        fail(e);
      } finally {
        if (alive) setPending(false);
      }
    };
    function resetScope() {
      setSignedIn(undefined);
      clearTimeout(overlayTimer);
      cancelAnimationFrame(overlayFrame);
      overlayParents.length = 0;
      setOverlayClosing(false);
      setOverlaySettled(false);
      setOverlayEntered(false);
      scope.abort();
      searchScope?.abort();
      setSearchChannelPaging(false);
      setSearchError("");
      settingsScope?.abort();
      pagingScope?.abort();
      pagingScope = undefined;
      pendingFocus = undefined;
      channelPending = undefined;
      channelRetry = undefined;
      scope = new AbortController();
      sourceScope?.abort();
      sourceScope = undefined;
      setLoading(false);
      setError("");
      setOverlay(undefined);
      setText("");
      pageBusy = false;
      clearTimeout(holdTimer);
      sourceFilterGeneration++;
      pageGeneration++;
      clearTimeout(searchTimer);
      return scope.signal;
    }
    function clearProfileView() {
      history.length = 0;
      batch(() => {
        setCaptionOverride(undefined);
        setPlaybackError("");
        setPage({ cards: [], complete: true });
        setSearch("");
        setSearchChannels([]);
        setSearchChannelPages([]);
        setSearchChannelError("");
        setSearchMediaPending(false);
        setSearchChannelsPending(false);
        setFilters({});
        setCatalog(undefined);
        setControls(undefined);
        setSources([]);
        setAllSourceIds([]);
        setAction(undefined);
        setActiveAction(undefined);
        setPickerCard(undefined);
        setSourceChannel(undefined);
        setActiveChannel(undefined);
        setActiveSource(undefined);
        setSelected(undefined);
        setDetail(undefined);
        setDetailAction(undefined);
        setPreviewCard(undefined);
        adoptChannelWindow([]);
        setPrograms({});
        setGuideInfo({});
        setLiveFavorites(undefined);
        setManagement(undefined);
        setNavigation(undefined);
        setAccountEmail("");
        setPreferences(undefined);
        setLibrary(undefined);
        setHome(undefined);
        setGroups([]);
        setLiveGroup(undefined);
        setSettingsItems([]);
        setHeroSlide(0);
        setHeroAction(0);
        setSaved(new Map());
      });
      guideTimes.clear();
      for (const flight of guideFlights.values()) flight.abort();
      guideFlights.clear();
    }
    function applyBootstrap(value: Bootstrap) {
      clearProfileView();
      batch(() => {
        setManagement(value.profile_management);
        setNavigation(value.navigation);
        setAccountEmail(
          value.identity.account?.username ??
            value.identity.account?.name ??
            "",
        );
        setPreferences(value.preferences ?? undefined);
        setHome(value.home ?? undefined);
        setSaved(new Map());
        lastRevisions = JSON.stringify(value.revisions ?? {});
        setLoading(false);
        setScreen(api.profile ? "home" : "profiles");
        setZone(api.profile ? "hero" : "profiles");
        setColumn(0);
        setRow(0);
      });
      scheduleRevisions();
    }
    async function start() {
      setLoading(true);
      setError("");
      try {
        if (await api.restore())
          applyBootstrap(await api.bootstrap(scope.signal));
        else setLoading(false);
      } catch (e) {
        fail(e);
      }
    }
    async function beginPairing() {
      if (screen() !== "pairing") setPairingFocused(false);
      const signal = resetScope();
      setScreen("pairing");
      setPairing(undefined);
      setQr("");
      setLoading(true);
      retry = () => void beginPairing();
      try {
        const value = await api.pair(signal);
        setPairing(value);
        const expires = performance.now() + value.expires_in * 1000;
        setPairingDeadline(expires);
        const codeImage = await QRCode.toDataURL(
          value.verification_uri_complete ?? value.verification_uri,
          { width: 300, margin: 2 },
        );
        if (signal.aborted) return;
        setQr(codeImage);
        setLoading(false);
        let interval = value.interval;
        while (performance.now() < expires) {
          await delay(interval * 1000, signal);
          try {
            await api.claim(value.device_code, signal);
            const authenticated = await api.bootstrap(signal);
            batch(() => {
              setSignedIn(authenticated);
              setPairing(undefined);
              setQr("");
              setScreen("signed-in");
              setZone("confirmation");
              setColumn(0);
              setRow(0);
            });
            return;
          } catch (e) {
            if (
              e instanceof RemoteError &&
              (e.code === "authorization_pending" || e.status === 429)
            ) {
              if (e.status === 429) interval = Math.min(60, interval + 5);
              continue;
            }
            throw e;
          }
        }
        throw new Error("This code has expired. Get a new code.");
      } catch (e) {
        fail(e);
      }
    }
    function finishSignIn() {
      const authenticated = signedIn();
      if (!authenticated || screen() !== "signed-in") return;
      setSignedIn(undefined);
      applyBootstrap(authenticated);
    }
    createEffect(() => {
      const value = home(),
        active = screen() === "home",
        signal = scope.signal;
      let timer: ReturnType<typeof setTimeout> | undefined,
        cancelled = false;
      if (value && !value.complete && active) {
        const refresh = async () => {
          try {
            const next = await api.home(signal);
            if (!cancelled) setHome(next);
          } catch (error) {
            if (!cancelled && !(error instanceof DOMException)) {
              if (error instanceof RemoteError && error.status === 401)
                fail(error);
              else timer = setTimeout(refresh, 5000);
            }
          }
        };
        timer = setTimeout(refresh, 2000);
      }
      onCleanup(() => {
        cancelled = true;
        clearTimeout(timer);
      });
    });
    function scheduleRevisions() {
      clearTimeout(revisionTimer);
      revisionTimer = setTimeout(async () => {
        try {
          if (
            !api.profile ||
            document.visibilityState !== "visible" ||
            screen() === "player" ||
            overlay() ||
            pending()
          )
            return;
          const signal = scope.signal,
            profile = api.profile;
          const revision = await call<Record<string, number | string>>(
            api.scoped("/revisions"),
            "GET",
            undefined,
            signal,
          );
          if (JSON.stringify(revision) === lastRevisions) return;
          const fresh = await api.bootstrap(signal);
          if (api.profile !== profile) {
            resetScope();
            applyBootstrap(fresh);
            return;
          }
          if (overlay() || pending()) return;
          const focusedNav =
            zone() === "nav" ? navs()[column()]?.id : undefined;
          setNavigation(fresh.navigation);
          if (
            ["movie", "series", "search", "live", "library"].includes(
              screen(),
            ) &&
            !navs().some((item) => item.id === screen())
          ) {
            resetScope();
            applyBootstrap(fresh);
            return;
          }
          if (focusedNav)
            setColumn(
              navIndex(
                navs().some((item) => item.id === focusedNav)
                  ? focusedNav
                  : "home",
              ),
            );
          restartPaging();
          invalidateHistory();
          setManagement(fresh.profile_management);
          setPreferences(fresh.preferences ?? undefined);
          replaceHome(fresh.home ?? undefined);
          setSaved(new Map());
          const view = screen();
          if (view === "library") replacePage(await loadLibrary("0", signal));
          else if (view === "movie" || view === "series")
            replacePage(await api.discover(browseQuery(), signal));
          else if (view === "search" && search()) updateSearch(search(), true);
          else if (view === "detail" && selected()) {
            const [value, intent] = await Promise.all([
              api.detail(selected()!, "0", signal),
              api.titleAction(selected()!, false, signal),
            ]);
            const key = focusedCard() ? cardKey(focusedCard()!) : undefined;
            batch(() => {
              setDetail(value);
              setDetailAction(intent);
              setSeasonIndex(0);
              if (zone() === "episodes" || zone() === "recommendations")
                setColumn(
                  focusIndex(
                    zone() === "recommendations" || !value.episodes.length
                      ? value.recommendations
                      : value.episodes,
                    key,
                    column(),
                  ),
                );
              else if (zone() === "seasons")
                setColumn(
                  Math.min(column(), Math.max(0, value.seasons.length - 1)),
                );
            });
          } else if (view === "settings")
            await loadSettings(settingsTab(), signal);
          else if (view === "live") {
            const value = await refreshChannelPage(false, signal);
            const focused = channels()[liveChannelIndex()]?.id;
            batch(() => {
              adoptLiveSnapshot(value.snapshot_id);
              adoptChannelWindow([value]);
              setGroups(value.groups);
              if (zone() === "live-groups")
                setColumn(Math.min(column(), value.groups.length));
              else if (zone() === "content")
                setColumn(
                  Math.max(
                    0,
                    value.channels.findIndex(
                      (channel) => channel.id === focused,
                    ),
                  ),
                );
              setPrograms({});
              setGuideInfo({});
            });
            void loadVisibleGuides();
          }
          // Commit the observed revision only after its dependent reads succeeded.
          lastRevisions = JSON.stringify(fresh.revisions ?? revision);
        } catch (error) {
          if (error instanceof RemoteError && error.status === 401) fail(error);
          else if (error instanceof RemoteError && error.status === 403) {
            try {
              const fresh = await api.bootstrap(scope.signal);
              resetScope();
              applyBootstrap(fresh);
            } catch (next) {
              fail(next);
            }
          }
        } finally {
          if (alive) scheduleRevisions();
        }
      }, 15000);
    }
    const focusedCard = createMemo(() => {
      if (screen() === "search" && zone() === "search-channels")
        return searchChannels()[column()]?.card;
      if (screen() === "home")
        return zone() === "rows"
          ? home()?.rows[row()]?.cards[column()]
          : undefined;
      if (screen() === "detail")
        return zone() === "recommendations"
          ? detail()?.recommendations[column()]
          : zone() === "episodes"
            ? detail()?.episodes.length
              ? detail()!.episodes[column()]
              : detail()?.recommendations[column()]
            : detail()?.item;
      return ["movie", "series", "search", "library"].includes(screen())
        ? page().cards[column()]
        : undefined;
    });
    const gridColumns = () => (screen() === "search" ? 5 : 7);
    const gridStart = () => {
      const index =
        screen() === "search" && zone() !== "content"
          ? searchMediaFocus
          : column();
      return (
        Math.max(
          0,
          Math.floor(index / gridColumns()) -
            (screen() === "search" && searchCapabilities().channels ? 0 : 1),
        ) * gridColumns()
      );
    };
    const gridCount = () =>
      screen() === "search" && searchCapabilities().channels
        ? 5
        : gridColumns() * 2;
    const searchNeedsRetry = () =>
      searchCapabilities().media &&
      !!search() &&
      !searchMediaPending() &&
      (!!searchError() || !page().complete);
    const [heroSlide, setHeroSlide] = createSignal(0);
    const [heroCycleStart, setHeroCycleStart] = createSignal(performance.now());
    const [heroVisible, setHeroVisible] = createSignal(
      document.visibilityState === "visible",
    );
    const heroMotion = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    const heroActive = createMemo(
      () =>
        screen() === "home" &&
        zone() !== "rows" &&
        !overlay() &&
        !pending() &&
        !loading() &&
        !error() &&
        heroVisible() &&
        heroMotion &&
        (home()?.featured.length ?? 0) > 1,
    );
    const resetHeroCycle = () => setHeroCycleStart(performance.now());
    let wasHeroActive = false;
    createEffect(() => {
      const active = heroActive();
      let started = heroCycleStart();
      if (!active) {
        wasHeroActive = false;
        return;
      }
      if (!wasHeroActive) {
        wasHeroActive = true;
        started = performance.now();
        setHeroCycleStart(started);
      }
      const timer = setTimeout(
        () => {
          if (!heroActive()) return;
          batch(() => {
            setHeroSlide((i) => (i + 1) % home()!.featured.length);
            resetHeroCycle();
          });
        },
        Math.max(0, 9000 - (performance.now() - started)),
      );
      onCleanup(() => clearTimeout(timer));
    });
    const [previewCard, setPreviewCard] = createSignal<Card>();
    createEffect(() => {
      const card = focusedCard(),
        active = zone() === "rows";
      const timer = setTimeout(
        () => setPreviewCard(active ? card : undefined),
        400,
      );
      onCleanup(() => clearTimeout(timer));
    });
    createEffect(() => {
      const card = focusedCard(),
        active = zone() === "rows";
      const timer = setTimeout(
        () => setPreviewCard(active ? card : undefined),
        matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 400,
      );
      onCleanup(() => clearTimeout(timer));
    });
    createEffect(()=>{const card=focusedCard(),active=zone()==="rows";const timer=setTimeout(()=>setPreviewCard(active?card:undefined),matchMedia('(prefers-reduced-motion: reduce)').matches?0:400);onCleanup(()=>clearTimeout(timer));});
    const hero = createMemo(() =>
      screen() === "home"
        ? zone() === "rows"
          ? (previewCard() ?? home()?.hero)
          : (home()?.featured[heroSlide()] ?? home()?.hero)
        : detail()?.item,
    );
    const billboardKey = createMemo(() =>
      screen() === "home" && zone() !== "rows" && hero()
        ? cardKey(hero()!)
        : undefined,
    );
    const billboard = createBillboardArt(
      () =>
        screen() === "home" && zone() !== "rows"
          ? hero()?.landscape
          : undefined,
      billboardKey,
    );
    createEffect(() => {
      billboardKey();
      resetHeroCycle();
    });
    function remember() {
      history.push({
        screen: screen(),
        zone: zone(),
        column: column(),
        row: row(),
        selected: selected(),
        detail: detail(),
        detailAction: detailAction(),
        seasonIndex: seasonIndex(),
        page: page(),
        focusKey: focusedCard() ? cardKey(focusedCard()!) : undefined,
        rowId: home()?.rows[row()]?.id,
      });
      if (history.length > 12) history.shift();
    }
    function focusIndex(
      cards: Card[],
      key: string | undefined,
      fallback: number,
    ) {
      const index =
        key === undefined
          ? -1
          : cards.findIndex((card) => cardKey(card) === key);
      return index >= 0
        ? index
        : Math.max(0, Math.min(fallback, cards.length - 1));
    }
    function replacePage(value: Page) {
      const focused = page().cards[column()];
      const index = focusIndex(
        value.cards,
        focused ? cardKey(focused) : undefined,
        column(),
      );
      batch(() => {
        setPage(value);
        if (zone() === "content") setColumn(index);
      });
      const modal = overlay();
      if (modal?.kind === "tracks") setChoice(Math.max(0,modal.columns[0]?.items.findIndex(item=>item.value==="✓") ?? 0));
    }
    async function loadLibrary(
      cursor = "0",
      signal = scope.signal,
      values = library()?.query ?? {},
    ) {
      const value = await api.library(cursor, signal, values);
      setLibrary(value);
      return value;
    }
    const libraryTypes = createMemo(
      () => library()?.controls?.find((c) => c.id === "type")?.choices ?? [],
    );
    const librarySort = createMemo(() =>
      library()?.controls?.find((c) => c.id === "sort"),
    );
    const libraryFilters = createMemo(() =>
      (library()?.controls ?? []).filter(
        (c) => c.id !== "type" && c.id !== "sort" && c.choices.length,
      ),
    );
    const libraryControlCount = () =>
      libraryTypes().length +
      Number(Boolean(librarySort()) || libraryFilters().length > 0);
    let libraryApplying = false;
    async function applyLibrary(values: LibraryQuery) {
      libraryApplying = true;
      try {
        const value = await loadLibrary("0", restartPaging(), values);
        replacePage(value);
      } finally {
        libraryApplying = false;
      }
    }
    function chooseLibrary(control: Control) {
      openOverlay({
        kind: "choices",
        title: control.label,
        items: [
          ...control.choices.map((item) => ({
            id: item.value,
            label: item.label,
            value:
              String(library()?.query?.[control.id] ?? "") === item.value
                ? "✓"
                : "",
            run: async () => {
              await applyLibrary({
                ...library()?.query,
                [control.id]: item.value,
              });
              closeOverlay();
            },
          })),
          ...(libraryFilters().length
            ? [{ id: "filters", label: "Filters", run: libraryFilterDialog }]
            : []),
        ],
      });
      setChoice(
        Math.max(
          0,
          control.choices.findIndex(
            (item) =>
              item.value === String(library()?.query?.[control.id] ?? ""),
          ),
        ),
      );
    }
    function libraryFilterDialog() {
      let draft = { ...library()?.query };
      const show = (focused = 0) => {
        openOverlay({
          kind: "choices",
          title: "Filters",
          items: [
            ...libraryFilters().map((control) => ({
              id: control.id,
              label: control.label,
              value:
                control.choices.find(
                  (item) => item.value === String(draft[control.id] ?? ""),
                )?.label ?? "",
              run: () => {
                const index = choice();
                openOverlay(
                  {
                    kind: "choices",
                    title: control.label,
                    items: control.choices.map((item) => ({
                      id: item.value,
                      label: item.label,
                      value:
                        item.value === String(draft[control.id] ?? "")
                          ? "✓"
                          : "",
                      run: () => {
                        draft[control.id] = item.value;
                        show(index);
                      },
                    })),
                  },
                  true,
                );
                setChoice(
                  Math.max(
                    0,
                    control.choices.findIndex(
                      (item) => item.value === String(draft[control.id] ?? ""),
                    ),
                  ),
                );
              },
            })),
            ...(library()?.default_query
              ? [
                  {
                    id: "clear",
                    label: "Clear",
                    run: () => {
                      draft = { ...library()!.default_query! };
                      show(libraryFilters().length);
                    },
                  },
                ]
              : []),
            {
              id: "apply",
              label: "Apply",
              run: async () => {
                await applyLibrary(draft);
                closeOverlay();
              },
            },
          ],
        });
        setChoice(focused);
      };
      show();
    }
    function replaceHome(value: Home | undefined) {
      const shelf = home()?.rows[row()],
        focused = shelf?.cards[column()];
      const nextRow = Math.max(
        0,
        value?.rows.findIndex((row) => row.id === shelf?.id) ?? 0,
      );
      const nextColumn = focusIndex(
        value?.rows[nextRow]?.cards ?? [],
        focused ? cardKey(focused) : undefined,
        column(),
      );
      batch(() => {
        setHome(value);
        setPreviewCard(undefined);
        setHeroSlide((index) =>
          Math.min(index, Math.max(0, (value?.featured.length ?? 1) - 1)),
        );
        if (screen() === "home" && zone() === "rows") {
          setRow(nextRow);
          setColumn(nextColumn);
        }
      });
      const modal = overlay();
      if (modal?.kind === "tracks") setChoice(Math.max(0,modal.columns[0]?.items.findIndex(item=>item.value==="✓") ?? 0));
    }
    function invalidateHistory() {
      for (const entry of history) {
        entry.stale = true;
        entry.page = undefined;
        entry.detail = undefined;
        entry.detailAction = undefined;
        if (entry.selected) entry.selected = lookupSelector(entry.selected);
      }
    }
    async function restorePrevious(previous: (typeof history)[number]) {
      if (
        ["movie", "series", "search", "live", "library"].includes(
          previous.screen,
        ) &&
        !navs().some((item) => item.id === previous.screen)
      ) {
        history.length = 0;
        await navigate("home");
        return;
      }
      const signal = resetScope();
      batch(() => {
        setScreen(previous.screen);
        setZone(previous.zone);
        setColumn(previous.column);
        setRow(previous.row);
        setSelected(previous.selected);
        setDetail(previous.detail);
        setDetailAction(previous.detailAction);
        setSeasonIndex(previous.seasonIndex);
        setPage(previous.page ?? { cards: [], complete: true });
        setLoading(!!previous.stale);
      });
      if (previous.screen === "search") {
        if (previous.stale || searchMediaPending() || searchChannelsPending())
          updateSearch(search(), true);
        return;
      }
      if (!previous.stale) return;
      retry = () => void restorePrevious(previous);
      try {
        if (previous.screen === "home") {
          const rows = home()?.rows ?? [];
          const nextRow = Math.max(
            0,
            rows.findIndex((row) => row.id === previous.rowId),
          );
          setRow(nextRow);
          if (previous.zone === "rows")
            setColumn(
              focusIndex(
                rows[nextRow]?.cards ?? [],
                previous.focusKey,
                previous.column,
              ),
            );
        } else if (previous.screen === "detail" && previous.selected) {
          const [value, intent] = await Promise.all([
            api.detail(previous.selected, "0", signal),
            api.titleAction(previous.selected, false, signal),
          ]);
          batch(() => {
            setDetail(value);
            setDetailAction(intent);
            setSeasonIndex(0);
            if (
              previous.zone === "episodes" ||
              previous.zone === "recommendations"
            )
              setColumn(
                focusIndex(
                  previous.zone === "recommendations" || !value.episodes.length
                    ? value.recommendations
                    : value.episodes,
                  previous.focusKey,
                  previous.column,
                ),
              );
          });
        } else if (["movie", "series", "library"].includes(previous.screen)) {
          const value =
            previous.screen === "library"
              ? await loadLibrary("0", signal)
              : await api.discover(browseQuery(), signal);
          batch(() => {
            setPage(value);
            if (previous.zone === "content")
              setColumn(
                focusIndex(value.cards, previous.focusKey, previous.column),
              );
          });
        }
      } catch (error) {
        fail(error);
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    }
    async function navigate(target: Screen) {
      if (screen() === "player") await player.stop();
      const signal = resetScope();
      if (target === "settings") {
        // Load the first settings group before the screen reports itself so a
        // caller that waits for the screen sees ready content, not an empty
        // column that swallows the first confirm.
        setLoading(true);
        setZone("settings-nav");
        setColumn(0);
        setRow(0);
        try {
          await loadSettings(2, signal);
        } catch (e) {
          fail(e);
        }
        setScreen(target);
        setLoading(false);
        return;
      }
      setScreen(target);
      if (["movie", "series", "library", "search", "live"].includes(target))
        setPage({ cards: [], complete: true });
      if (target === "live") {
        adoptChannelWindow([]);
        setPrograms({});
        setGuideInfo({});
      }
      setColumn(0);
      setRow(0);
      setZone(
        target === "home" ? "hero" : target === "profiles" ? "profiles" : "content",
      );
      setHeroAction(0);
      retry = () => void navigate(target);
      try {
        if (target === "home") {
          if (!home()) setLoading(true);
          setHome(await api.home(signal));
        } else if (target === "profiles") {
          setManagement(await api.profiles(signal));
        } else if (target === "movie" || target === "series") {
          setLoading(true);
          setPage({ cards: [], complete: true });
          const result = await api.controls(target, signal);
          setControls(result);
          const first = result.catalogs[0];
          setCatalog(first);
          setFilters({});
          setPage(
            await api.discover(
              {
                type: target,
                ...(first
                  ? { catalog: first.id, addon_id: first.addon_id }
                  : {}),
              },
              signal,
            ),
          );
          setZone("filters");
        } else if (target === "library") {
          setLoading(true);
          setPage(await loadLibrary("0", signal));
        } else if (target === "search") {
          setPage({ cards: [], complete: true });
          setZone("keyboard");
          setKey(2);
          if (search()) {
            updateSearch(search());
            return;
          }
        } else if (target === "live") {
          setLoading(true);
          const result = await api.live("0", undefined, signal);
          adoptLiveSnapshot(result.snapshot_id);
          adoptChannelWindow([result]);
          void call<{ channel_ids: string[] }>(
            api.scoped("/live/favorites"),
            "GET",
            undefined,
            signal,
          )
            .then((value) => setLiveFavorites(new Set(value.channel_ids)))
            .catch(() => {});
          setGroups(result.groups);
          setLiveGroup(undefined);
          setPrograms({});
          void loadVisibleGuides();
        }
        setLoading(false);
      } catch (e) {
        fail(e);
      }
    }
    async function openDetail(card: Card) {
      remember();
      const signal = resetScope();
      setSelected(card);
      setScreen("detail");
      setZone("hero");
      setHeroAction(0);
      setLoading(true);
      setDetail(undefined);
      setDetailAction(undefined);
      setSeasonIndex(0);
      retry = () => void openDetail(card);
      try {
        const [value, intent] = await Promise.all([
          api.detail(card, "0", signal),
          api.titleAction(card, false, signal),
        ]);
        if (signal.aborted) return;
        setDetail(value);
        setDetailAction(intent);
        setLoading(false);
      } catch (e) {
        fail(e);
      }
    }
    function openOverlay(value: Overlay, child = false) {
      clearTimeout(overlayTimer);
      cancelAnimationFrame(overlayFrame);
      setOverlayClosing(false);
      if (child && overlay())
        overlayParents.push({ value: overlay()!, choice: choice() });
      else overlayParents.length = 0;
      overlayFocus = {
        zone: zone(),
        column: column(),
        row: row(),
        choice: choice(),
      };
      setChoice(0);
      setError("");
      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      setOverlayEntered(reduced);
      setOverlaySettled(reduced);
      setOverlay(value);
      if (!reduced)
        overlayFrame = requestAnimationFrame(() => {
          setOverlayEntered(true);
          overlayTimer = setTimeout(() => setOverlaySettled(true), 320);
        });
      if (value.kind === "text") {
        setKeyboardUpper(false);
        setKeyboardSymbols(false);
        setText(value.initial ?? "");
        setKey(0);
      }
    }
    function closeOverlay() {
      sourceScope?.abort();
      sourceScope = undefined;
      overlayParents.length = 0;
      clearTimeout(overlayTimer);
      cancelAnimationFrame(overlayFrame);
      const focus = overlayFocus,
        current = overlay();
      const finish = () => {
        setOverlay(undefined);
        setOverlayClosing(false);
        setOverlaySettled(false);
        setOverlayEntered(false);
        setText("");
        setError(screen() === "player" ? playbackError() : "");
        setZone(focus.zone);
        setColumn(focus.column);
        setRow(focus.row);
        setChoice(focus.choice);
      };
      const animated =
        current &&
        (current.kind === "sources" ||
          current.kind === "tracks" ||
          ((current.kind === "choices" || current.kind === "confirm") &&
            !current.profile));
      if (animated && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setOverlayClosing(true);
        overlayTimer = setTimeout(finish, 200);
      } else finish();
    }
    function dismissOverlay() {
      if (libraryApplying) restartPaging();
      const previous = overlayParents.pop();
      if (!previous) {
        closeOverlay();
        return;
      }
      clearTimeout(overlayTimer);
      cancelAnimationFrame(overlayFrame);
      setOverlayClosing(false);
      setOverlaySettled(true);
      setOverlayEntered(true);
      setOverlay(previous.value);
      setChoice(previous.choice);
      setText("");
      setError("");
    }
    async function leavePlayer() {
      resetScope();
      await player.stop();
      setPlaybackError("");
      batch(() => {
        setLoading(false);
        setScreen(returnScreen);
        setZone(returnFocus.zone);
        setColumn(returnFocus.column);
        setRow(returnFocus.row);
        setError("");
      });
      if (
        returnScreen === "search" &&
        (searchMediaPending() || searchChannelsPending())
      )
        updateSearch(search(), true);
    }
    async function back() {
      if (screen() === "signed-in") {
        finishSignIn();
        return;
      }
      if (
        !overlay() &&
        (screen() === "welcome" || (screen() === "profiles" && !api.profile))
      ) {
        if (platform === "webos") exitWebos();
        return;
      }
      if (overlay()) {
        const current = overlay()!;
        if (current.kind === "calibration") {
          // Cancel restores the server-saved inset opened with the overlay.
          applyScreenInset(current.value);
          closeOverlay();
          return;
        }
        dismissOverlay();
        return;
      }
      if (screen() === "player") {
        await leavePlayer();
        return;
      }
      if (screen() === "pairing") {
        resetScope();
        setScreen("welcome");
        return;
      }
      if (screen() === "settings") {
        if (zone() !== "settings-nav") {
          setZone("settings-nav");
          return;
        }
        if (!history.length) {
          await navigate("home");
          return;
        }
      }
      const previous = history.pop();
      if (previous) {
        await restorePrevious(previous);
      } else if (
        zone() !== "nav" &&
        !["welcome", "profiles"].includes(screen())
      ) {
        setZone("nav");
        setColumn(
          Math.max(
            0,
            navs().findIndex((n) => n.id === screen()),
          ),
        );
      } else if (platform === "webos" && screen() === "profiles") exitWebos();
      else if (platform === "webos" && screen() === "home")
        await navigate("profiles");
      else await navigate("home");
    }
    async function refreshChannelPage(
      searching: boolean,
      signal: AbortSignal,
    ): Promise<LivePage> {
      const generation = pageGeneration;
      const pages = () => (searching ? searchChannelPages() : livePages());
      const focused = () =>
        searching
          ? searchChannels()[
              zone() === "search-channels" ? column() : searchChannelFocus
            ]
          : channels()[liveChannelIndex()];
      const focusedPage = () => {
        const card = focused();
        return card
          ? pages().find((page) =>
              page.channels.some(
                (channel) => channelKey(channel) === channelKey(card),
              ),
            )
          : undefined;
      };
      for (;;) {
        const target = focusedPage() ?? pages()[0];
        const request = target
          ? pageRequest(target)
          : { cursor: "0", limit: 40, page_size: 40 };
        const snapshot = pages()[0]?.snapshot_id;
        const value = await api.live(
          request.cursor,
          searching ? undefined : liveGroup(),
          signal,
          searching ? search() : undefined,
          target ? request : undefined,
        );
        if (generation !== pageGeneration || signal.aborted)
          throw new DOMException("Retired channel refresh", "AbortError");
        if (snapshot && value.snapshot_id !== snapshot) {
          adoptChannelWindow([], searching);
          if (!searching) retireLiveGuides();
          const first =
            request.cursor === "0"
              ? value
              : await api.live(
                  "0",
                  searching ? undefined : liveGroup(),
                  signal,
                  searching ? search() : undefined,
                );
          if (generation !== pageGeneration || signal.aborted)
            throw new DOMException("Retired channel refresh", "AbortError");
          return first;
        }
        const latest = focusedPage();
        // Focus remains interactive during refresh. If it crossed a retained
        // page, fetch that page instead of replacing its current focus with 0.
        if (latest && !samePageRequest(request, pageRequest(latest))) continue;
        return value;
      }
    }
    function moveChannel(step: number, searching: boolean) {
      const pages = searching ? searchChannelPages() : livePages();
      const values = searching ? searchChannels() : channels();
      const direction: PageDirection = step < 0 ? "previous" : "next";
      const next = column() + step;
      if (next < 0 && !edgeRequest(pages, "previous")) {
        setZone(searching ? "keyboard" : "live-groups");
        setColumn(0);
        return;
      }
      if (next >= 0 && next < values.length) setColumn(next);
      else if (edgeRequest(pages, direction) && values[column()])
        channelPending = { from: channelKey(values[column()]), direction };
      if (searching) searchChannelFocus = column();
      else {
        const id = channels()[column()]?.id;
        setProgramIndex(
          Math.max(
            0,
            (programs()[id] ?? []).findIndex(
              (p) => p.id === guideInfo()[id]?.current_program_id,
            ),
          ),
        );
        void loadVisibleGuides();
      }
      // Only actual directional movement prefetches. Applying a short reverse
      // page never initiates a compensating forward request by itself.
      if (
        (step < 0 && column() < 6) ||
        (step > 0 && column() >= values.length - 6)
      )
        void moreChannels(direction);
    }
    async function moreChannels(direction: PageDirection) {
      const searching = screen() === "search",
        expectedScreen = screen(),
        expectedZone = zone();
      const pages = () => (searching ? searchChannelPages() : livePages());
      const values = () => (searching ? searchChannels() : channels());
      const request = edgeRequest(pages(), direction),
        generation = pageGeneration;
      if (pageBusy || !request) return;
      pageBusy = true;
      const signal = searching ? searchSignal() : pageSignal();
      if (searching) setSearchChannelPaging(true);
      else retry = () => void moreChannels(direction);
      try {
        const value = await api.live(
          request.cursor,
          searching ? undefined : liveGroup(),
          signal,
          searching ? search() : undefined,
          request,
        );
        if (
          signal.aborted ||
          generation !== pageGeneration ||
          screen() !== expectedScreen ||
          zone() !== expectedZone ||
          overlay() ||
          !samePageRequest(request, edgeRequest(pages(), direction))
        )
          return;
        if (value.snapshot_id !== pages()[0]?.snapshot_id) {
          if (searching) updateSearch(search());
          else {
            adoptChannelWindow([]);
            retireLiveGuides();
            await loadLiveGroup(liveGroup()).catch(fail);
          }
          return;
        }
        const focused = values()[column()];
        const next = joinChannelWindow(pages(), value, direction);
        const items = next.flatMap((page) => page.channels);
        const anchor = focused
          ? items.findIndex(
              (channel) => channelKey(channel) === channelKey(focused),
            )
          : -1;
        // The user may have reversed into the page we would evict while the
        // request was in flight. Discard that prefetch instead of moving focus.
        if (anchor < 0) return;
        const advance =
          channelPending?.from === channelKey(focused) &&
          channelPending.direction === direction;
        const index = Math.max(
          0,
          Math.min(
            items.length - 1,
            anchor + (advance ? (direction === "next" ? 1 : -1) : 0),
          ),
        );
        batch(() => {
          adoptChannelWindow(next, searching);
          // Focus is the channel's position in the accumulated list.
          const globalIndex = channels().findIndex(
            (channel) => channelKey(channel) === channelKey(items[index]),
          );
          setColumn(globalIndex >= 0 ? globalIndex : index);
          if (searching) {
            searchChannelFocus = index;
            setSearchChannelError("");
          }
        });
        channelPending = undefined;
        channelRetry = undefined;
        if (!searching) void loadVisibleGuides();
      } catch (error) {
        if (
          generation !== pageGeneration ||
          signal.aborted ||
          screen() !== expectedScreen ||
          zone() !== expectedZone ||
          overlay()
        )
          return;
        channelPending = undefined;
        channelRetry = direction;
        if (error instanceof RemoteError && error.status === 401) fail(error);
        else if (searching)
          setSearchChannelError(
            error instanceof Error
              ? error.message
              : "Channels are unavailable. Try again.",
          );
        else fail(error);
      } finally {
        if (generation === pageGeneration) {
          pageBusy = false;
          if (searching) setSearchChannelPaging(false);
          const waiting = channelPending;
          const focused = values()[column()];
          if (
            waiting &&
            focused &&
            waiting.from === channelKey(focused) &&
            screen() === expectedScreen &&
            zone() === expectedZone &&
            !overlay()
          )
            void moreChannels(waiting.direction);
        }
      }
    }
    async function more() {
      const generation = pageGeneration;
      if (
        screen() === "live" ||
        (screen() === "search" && zone() === "search-channels")
      ) {
        await moreChannels("next");
        return;
      }
      if (screen() === "detail") {
        const current = detail(),
          card = selected();
        if (pageBusy || !current?.next_cursor || !card) return;
        pageBusy = true;
        try {
          const next = await api.detail(
            card,
            current.next_cursor,
            pageSignal(),
          );
          if (generation !== pageGeneration) return;
          if (next.next_cursor === current.next_cursor)
            throw new Error("The server repeated an episode page.");
          setDetail({
            ...next,
            episodes: [...current.episodes, ...next.episodes],
          });
        } catch (error) {
          if (generation === pageGeneration) {
            pendingFocus = undefined;
            fail(error);
          }
        } finally {
          if (generation === pageGeneration) {
            pageBusy = false;
            settlePendingFocus();
          }
        }
        return;
      }
      if (pageBusy || !page().next_cursor) return;
      pageBusy = true;
      const cursor = page().next_cursor!,
        signal = pageSignal();
      try {
        let result: Page;
        if (screen() === "library") result = await loadLibrary(cursor, signal);
        else result = await api.discover(browseQuery(cursor), signal);
        if (generation !== pageGeneration) return;
        if (result.next_cursor === cursor)
          throw new Error("The server repeated a page.");
        setPage((old) => ({
          ...result,
          cards: [...old.cards, ...result.cards],
        }));
      } catch (e) {
        if (generation === pageGeneration) {
          pendingFocus = undefined;
          fail(e);
        }
      } finally {
        if (generation === pageGeneration) {
          pageBusy = false;
          settlePendingFocus();
        }
      }
    }
    function browseQuery(skip = "0") {
      const current = catalog();
      return {
        type: screen(),
        catalog: current?.id,
        addon_id: current?.addon_id,
        skip,
        values: Object.entries(filters()).map(([id, values]) => ({
          id,
          values,
        })),
      };
    }
    async function loadBrowse() {
      const signal = restartPaging();
      setLoading(true);
      setPage({ cards: [], complete: true });
      try {
        setPage(await api.discover(browseQuery(), signal));
        setColumn(0);
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    }
    const guideFlights = new Map<string, AbortController>();
    const guideTimes = new Map<string, number>();
    let guideWindow = 0;
    function retireLiveGuides() {
      guideWindow++;
      for (const flight of guideFlights.values()) flight.abort();
      guideFlights.clear();
      guideTimes.clear();
      setPrograms({});
      setGuideInfo({});
      setProgramIndex(0);
    }
    function adoptLiveSnapshot(id: string) {
      if (id !== liveSnapshot()) retireLiveGuides();
      setLiveSnapshot(id);
    }
    const guideKeep = () =>
      new Set(
        channels()
          .slice(Math.max(0, liveChannelIndex() - 10), liveChannelIndex() + 15)
          .map((channel) => channel.id),
      );
    function trimGuides() {
      const keep = guideKeep();
      batch(() => {
        setPrograms((old) =>
          Object.fromEntries(
            Object.entries(old).filter(([id]) => keep.has(id)),
          ),
        );
        setGuideInfo((old) =>
          Object.fromEntries(
            Object.entries(old).filter(([id]) => keep.has(id)),
          ),
        );
      });
      for (const id of guideTimes.keys())
        if (!keep.has(id)) guideTimes.delete(id);
    }
    async function loadGuide(index: number, force = false) {
      const channel = channels()[index];
      if (
        !channel ||
        (!force &&
          programs()[channel.id] &&
          Date.now() - (guideTimes.get(channel.id) ?? 0) < 30_000) ||
        (guideFlights.has(channel.id) &&
          !guideFlights.get(channel.id)!.signal.aborted)
      )
        return;
      const owner = scope;
      const request = new AbortController();
      const cancel = () => request.abort();
      if (owner.signal.aborted) return;
      owner.signal.addEventListener("abort", cancel, { once: true });
      guideFlights.set(channel.id, request);
      const focusedProgram =
        channels()[liveChannelIndex()]?.id === channel.id
          ? currentProgram()?.id
          : undefined;
      try {
        const result = await call<Guide>(
          api.scoped(`/live/${segment(channel.id)}/guide`),
          "GET",
          undefined,
          request.signal,
        );
        if (
          scope !== owner ||
          request.signal.aborted ||
          !guideKeep().has(channel.id)
        )
          return;
        guideTimes.set(channel.id, Date.now());
        batch(() => {
          setPrograms((old) => ({ ...old, [channel.id]: result.programs }));
          setGuideInfo((old) => ({ ...old, [channel.id]: result.view }));
          if (channels()[liveChannelIndex()]?.id === channel.id) {
            const retained = result.programs.findIndex(
              (program) => program.id === focusedProgram,
            );
            setProgramIndex(
              retained >= 0
                ? retained
                : Math.max(
                    0,
                    result.programs.findIndex(
                      (program) =>
                        program.id === result.view?.current_program_id,
                    ),
                  ),
            );
          }
        });
        trimGuides();
      } catch (e) {
        if (
          scope === owner &&
          !request.signal.aborted &&
          !(e instanceof DOMException)
        )
          notify("Programme information is unavailable.");
      } finally {
        owner.signal.removeEventListener("abort", cancel);
        if (guideFlights.get(channel.id) === request)
          guideFlights.delete(channel.id);
      }
    }
    async function loadVisibleGuides(force = false) {
      const owner = scope,
        ticket = ++guideWindow;
      const start = Math.max(0, guideRowStart()),
        end = guideRowStart() + 5;
      const visible = new Set(
        channels()
          .slice(start, end)
          .map((channel) => channel.id),
      );
      for (const [id, flight] of guideFlights)
        if (!visible.has(id)) flight.abort();
      trimGuides();
      for (let i = start; i < Math.min(channels().length, end); i += 3) {
        if (owner !== scope || owner.signal.aborted || ticket !== guideWindow)
          return;
        await Promise.all(
          Array.from(
            { length: Math.min(3, channels().length - i, end - i) },
            (_, n) => loadGuide(i + n, force),
          ),
        );
      }
    }
    onMount(() => {
      const timer = setInterval(() => {
        if (
          screen() === "live" &&
          !loading() &&
          !overlay() &&
          document.visibilityState === "visible"
        )
          void loadVisibleGuides(true);
      }, 30_000);
      onCleanup(() => clearInterval(timer));
    });
    if (new URLSearchParams(location.search).has("perfdebug")) {
      const target = window as Window & {
        __viptvRemoteMetrics?: () => Record<string, number>;
      };
      target.__viptvRemoteMetrics = () => ({
        guideSnapshots: Object.keys(programs()).length,
        guideRequestsInFlight: [...guideFlights.values()].filter(
          (request) => !request.signal.aborted,
        ).length,
        catalogCards: page().cards.length,
        livePayloadPages: livePages().length,
        livePayloadChannels: channels().length,
        searchPayloadPages: searchChannelPages().length,
        searchPayloadChannels: searchChannels().length,
        homeCards: (home()?.rows ?? []).reduce(
          (sum, row) => sum + row.cards.length,
          0,
        ),
        historyEntries: history.length,
      });
      onCleanup(() => {
        delete target.__viptvRemoteMetrics;
      });
    }
    async function loadLiveGroup(group: string | undefined) {
      const signal = restartPaging();
      retireLiveGuides();
      setLiveGroup(group);
      setLoading(true);
      adoptChannelWindow([]);
      setPrograms({});
      setGuideInfo({});
      setPage({ cards: [], complete: true });
      retry = () => void loadLiveGroup(group).catch(fail);
      try {
        const value = await api.live("0", group, signal);
        batch(() => {
          adoptLiveSnapshot(value.snapshot_id);
          adoptChannelWindow([value]);
          setGroups(value.groups);
          setColumn(0);
          setZone("content");
        });
        void loadVisibleGuides();
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    }
    function searchSignal() {
      if (!searchScope || searchScope.signal.aborted) {
        const owner = scope,
          request = new AbortController();
        const cancel = () => request.abort();
        owner.signal.addEventListener("abort", cancel, { once: true });
        request.signal.addEventListener(
          "abort",
          () => owner.signal.removeEventListener("abort", cancel),
          { once: true },
        );
        if (owner.signal.aborted) request.abort();
        searchScope = request;
      }
      return searchScope.signal;
    }
    function updateSearch(value: string, retain = false) {
      value = Array.from(value).slice(0, 256).join("");
      retain = retain && value === search();
      searchScope?.abort();
      clearTimeout(searchTimer);
      restartPaging();
      const signal = searchSignal();
      const capabilities = searchCapabilities();
      const current = () =>
        !signal.aborted &&
        searchScope?.signal === signal &&
        screen() === "search" &&
        search() === value;
      const settle = () =>
        setLoading(
          !page().cards.length &&
            !searchChannels().length &&
            (searchMediaPending() || searchChannelsPending()),
        );
      batch(() => {
        setSearch(value);
        if (!retain || !capabilities.media)
          setPage({ cards: [], complete: !value });
        if (!retain || !capabilities.channels) {
          setSearchChannels([]);
          setSearchChannelPages([]);
        }
        if (!retain) {
          searchMediaFocus = 0;
          searchChannelFocus = 0;
        }
        if (
          (!capabilities.media &&
            ["content", "search-retry"].includes(zone())) ||
          (!capabilities.channels &&
            ["search-channels", "search-channel-retry"].includes(zone()))
        )
          setZone("keyboard");
        setError("");
        setSearchError("");
        setSearchChannelError("");
        setSearchChannelPaging(false);
        setSearchMediaPending(!!value && capabilities.media);
        setSearchChannelsPending(!!value && capabilities.channels);
        settle();
      });
      retry = () => updateSearch(value, true);
      searchTimer = setTimeout(() => {
        if (!value || !current()) return;
        if (capabilities.media)
          void api
            .discover({ type: "all", search: value }, signal)
            .then((result) => {
              if (current()) replacePage(result);
            })
            .catch((error) => {
              if (!current()) return;
              if (error instanceof RemoteError && error.status === 401)
                fail(error);
              else
                setSearchError(
                  error instanceof Error
                    ? error.message
                    : "Search is unavailable. Try again.",
                );
            })
            .finally(() => {
              if (current())
                batch(() => {
                  setSearchMediaPending(false);
                  settle();
                });
            });
        if (capabilities.channels)
          void refreshChannelPage(true, signal)
            .then((result) => {
              if (!current()) return;
              const focused =
                searchChannels()[
                  zone() === "search-channels" ? column() : searchChannelFocus
                ]?.id;
              batch(() => {
                adoptChannelWindow([result], true);
                searchChannelFocus = Math.max(
                  0,
                  result.channels.findIndex(
                    (channel) => channel.id === focused,
                  ),
                );
                if (zone() === "search-channels") setColumn(searchChannelFocus);
                if (result.availability !== "Available")
                  setSearchChannelError(
                    result.reason ?? "Channel search is unavailable.",
                  );
              });
            })
            .catch((error) => {
              if (!current()) return;
              if (error instanceof RemoteError && error.status === 401)
                fail(error);
              else
                setSearchChannelError(
                  error instanceof Error
                    ? error.message
                    : "Channels are unavailable. Try again.",
                );
            })
            .finally(() => {
              if (current())
                batch(() => {
                  setSearchChannelsPending(false);
                  settle();
                });
            });
      }, 180);
    }
    function reconcileSources(value: Source[]) {
      const focused = sources()[choice()]?.id;
      setSources(value);
      const index = value.findIndex((source) => source.id === focused);
      setChoice(
        index >= 0 ? index : Math.max(0, Math.min(choice(), value.length - 1)),
      );
    }
    async function playIntent(
      card: Card,
      forcePicker = false,
      restart = false,
      channel?: string,
      replaceCurrent = false,
    ) {
      sourceScope?.abort();
      const operation = new AbortController();
      sourceScope = operation;
      setPickerCard(card);
      setSourceChannel(channel);
      setReplacingSource(replaceCurrent);
      setAction(undefined);
      setSources([]);
      setAllSourceIds([]);
      setSourcePage(undefined);
      setSourceFacet(0);
      setSourceHeight(undefined);
      setSourceFiltering(false);
      manualSourceSelection = false;
      sourceFilterGeneration++;
      setSourceFilterFocus(false);
      setSourceLoading(true);
      openOverlay({ kind: "sources", title: "Choose a source" });
      retry = () =>
        void playIntent(card, forcePicker, restart, channel, replaceCurrent);
      try {
        let resolved = channel
          ? undefined
          : await api.titleAction(card, restart, operation.signal);
        if (resolved) {
          setAction(resolved);
          setPickerCard(resolved.card);
        }
        const ranked = await api.sources(
          resolved?.card ?? card,
          (value, page, ids, height) => {
            if (sourceScope !== operation || operation.signal.aborted) return;
            if (page.action) {
              resolved = page.action;
              setAction(page.action);
              setPickerCard(page.action.card);
            }
            const ticket = ++sourceFilterGeneration;
            const focusedHeight = sourceFacet()
              ? sourcePage()?.quality_filters?.[sourceFacet() - 1]?.height
              : undefined;
            setAllSourceIds(ids);
            setSourcePage(page);
            if (sourceFilterFocus())
              setSourceFacet(
                focusedHeight === undefined
                  ? 0
                  : Math.max(
                      0,
                      (page.quality_filters ?? []).findIndex(
                        (filter) => filter.height === focusedHeight,
                      ) + 1,
                    ),
              );
            if (height === sourceHeight()) {
              reconcileSources(value);
              setSourceFiltering(false);
            } else {
              const wanted = sourceHeight();
              setSourceFiltering(true);
              void api
                .rankSources(ids, wanted, operation.signal)
                .then((result) => {
                  if (
                    ticket === sourceFilterGeneration &&
                    sourceScope === operation &&
                    !operation.signal.aborted
                  ) {
                    setSourcePage(result);
                    reconcileSources(result.streams);
                    setSourceFiltering(false);
                  }
                })
                .catch((error) => {
                  if (
                    ticket === sourceFilterGeneration &&
                    sourceScope === operation
                  ) {
                    setSourceFiltering(false);
                    fail(error);
                  }
                });
            }
          },
          operation.signal,
          channel,
          () => sourceHeight(),
        );
        setSourceLoading(false);
        if (
          !forcePicker &&
          !manualSourceSelection &&
          resolved?.source_selection === "best" &&
          !operation.signal.aborted
        ) {
          const best = ranked.find(
            (source) => source.id === sourcePage()?.best_match_id,
          );
          if (best) await playSource(best);
        }
      } catch (e) {
        if (sourceScope !== operation) return;
        setSourceLoading(false);
        if (sources().length && !(e instanceof DOMException))
          notify(
            "Some sources did not respond. You can choose an available source.",
          );
        else fail(e);
      }
    }
    async function playSource(source: Source) {
      const current = action();
      if (!current) return;
      const channel = sourceChannel();
      retry = () =>
        void playIntent(
          current.card,
          true,
          false,
          channel,
          player.canReplaceSource,
        );
      if (screen() !== "player") {
        returnScreen = screen();
        returnFocus = {
          zone: overlayFocus.zone,
          column: overlayFocus.column,
          row: overlayFocus.row,
        };
      }
      sourceScope?.abort();
      setOverlay(undefined);
      if (screen() === "search") {
        searchScope?.abort();
        clearTimeout(searchTimer);
      }
      setScreen("player");
      setError("");
      setPlaybackError("");
      setActiveSource(source);
      setActiveAction(current);
      setActiveChannel(sourceChannel());
      setShowControls(true);
      setChoice(0);
      setLoading(true);
      document.getElementById("video-layer")!.style.display = "block";
      try {
        if (replacingSource()) await player.replaceSource(source);
        else await player.start(current.card, source, current.resume);
        setLoading(false);
        hideControls();
      } catch (e) {
        fail(e);
      }
    }
    function hideControls() {
      clearTimeout(controlsTimer);
      controlsTimer = setTimeout(() => {
        if (!error() && snapshot()?.state === "playing") setShowControls(false);
      }, 5000);
    }
    async function toggleSaved(card: Card) {
      await run(async () => {
        const key = cardKey(card);
        const receipt = isSaved(card)
          ? await call<{ saved: boolean }>(
              api.scoped(
                `/library/${segment(card.identity.kind)}/${segment(card.identity.id)}?${query(card.metadata_origin ? { metadata_origin: card.metadata_origin, card: lookupSelector(card) } : {})}`,
              ),
              "DELETE",
            )
          : await call<{ saved: boolean }>(api.scoped("/library"), "PUT", {
              card,
            });
        setSaved((old) => new Map(old).set(key, receipt.saved));
        notify(receipt.saved ? "Added to My List" : "Removed from My List");
      });
    }
    function filtersOverlay(control: Control) {
      const chosen = filters()[control.id] ?? [];
      openOverlay({
        kind: "choices",
        title: control.label,
        items: [
          {
            id: "clear",
            label: "All",
            run: async () => {
              setFilters((old) => ({ ...old, [control.id]: [] }));
              closeOverlay();
              await loadBrowse();
            },
          },
          ...control.choices.map((item) => ({
            id: item.value,
            label: item.label,
            value: chosen.includes(item.value) ? "✓" : "",
            run: async () => {
              const values = filters()[control.id] ?? [];
              const next =
                control.maximum_selections && control.maximum_selections > 1
                  ? values.includes(item.value)
                    ? values.filter((v) => v !== item.value)
                    : [...values, item.value].slice(-control.maximum_selections)
                  : [item.value];
              setFilters((old) => ({ ...old, [control.id]: next }));
              closeOverlay();
              await loadBrowse();
            },
          })),
        ],
      });
    }
    function edit(
      title: string,
      submit: (value: string) => Promise<void>,
      initial = "",
      secret = false,
    ) {
      openOverlay(
        {
          kind: "text",
          title,
          initial,
          secret,
          numeric: secret && title.endsWith("PIN"),
          submit,
        },
        true,
      );
    }
    // The settings boards' canonical order; sign-out lives under Account.
    const settingsTabs = [
      "Account",
      "Profiles",
      "Playback",
      "Subtitles & audio",
      "Add-ons",
      "Source integrations",
      "Display",
      "Parental controls",
      "About",
    ];
    async function preferenceChoice(
      field: string,
      label: string,
      values: [string, string | number | boolean | null][],
    ) {
      openOverlay({
        kind: "choices",
        title: label,
        items: values.map(([name, value]) => ({
          id: String(value),
          label: name,
          value: preferences()?.preferences[field] === value ? "✓" : "",
          run: async () => {
            const previous = preferences()!;
            const receipt = await call<Preferences>(
              api.scoped("/preferences"),
              "PUT",
              {
                revision: previous.revision,
                preferences: { ...previous.preferences, [field]: value },
              },
            );
            setPreferences(receipt);
            closeOverlay();
            await loadSettings(settingsTab(), scope.signal);
          },
        })),
      });
    }
    /** Tv3SetDisplay rows: swatches and toggles adjust inline; text size,
     * motion and screen saver use the shared choice overlay; Fit to screen
     * opens the calibration overlay. Every change is a confirmed server write. */
    function displayItem(
      control: NonNullable<Preferences["controls"]>[number],
      pref: Preferences,
    ): Item {
      const display = () => preferences()?.display ?? defaultDisplayPreferences;
      const put = async (patch: Partial<DisplayPreferences>) => {
        const previous = preferences()!;
        const receipt = await call<Preferences>(
          api.scoped("/preferences"),
          "PUT",
          {
            revision: previous.revision,
            display: { ...previous.display, ...patch },
          },
        );
        setPreferences(receipt);
        await loadSettings(settingsTab(), scope.signal);
      };
      const choices = control.choices ?? [];
      const current = display()[control.id as keyof DisplayPreferences];
      if (control.kind === "swatches") {
        const colors = choices.map((choice) => String(choice.value));
        const step = async (direction: number) => {
          const index = colors.indexOf(String(current));
          const next =
            colors[(index + direction + colors.length) % colors.length];
          if (next && next !== current) await put({ accent_color: next });
        };
        return {
          id: control.id,
          label: control.label,
          description: control.description,
          swatches: colors,
          value: String(current),
          run: () => step(1),
          cycle: step,
        };
      }
      if (
        choices.length === 2 &&
        choices.every((choice) => typeof choice.value === "boolean")
      ) {
        const flip = async () => {
          await put({ [control.id]: !current } as Partial<DisplayPreferences>);
        };
        return {
          id: control.id,
          label: control.label,
          description: control.description,
          toggle: current === true,
          value: "",
          run: flip,
          cycle: flip,
        };
      }
      if (control.kind === "calibration") {
        return {
          id: control.id,
          label: control.label,
          description: control.description,
          value: "",
          run: () => {
            setCalibrationValue(display().screen_inset);
            openOverlay({
              kind: "calibration",
              title: control.label,
              min: control.min ?? 0,
              max: control.max ?? 20,
              value: display().screen_inset,
              save: (next) => put({ screen_inset: next }),
            });
          },
        };
      }
      return {
        id: control.id,
        label: control.label,
        description: control.description,
        value:
          choices.find((choice) => choice.value === current)?.label ??
          String(current ?? ""),
        chevron: true,
        run: () =>
          openOverlay({
            kind: "choices",
            title: control.label,
            items: choices.map((choice) => ({
              id: String(choice.value),
              label: choice.label,
              value:
                display()[control.id as keyof DisplayPreferences] ===
                choice.value
                  ? "✓"
                  : "",
              run: async () => {
                await put({
                  [control.id]: choice.value,
                } as Partial<DisplayPreferences>);
                closeOverlay();
              },
            })),
          }),
      };
    }
    async function loadSettings(tab: number, signal: AbortSignal) {
      if (signal.aborted) return;
      settingsScope?.abort();
      settingsScope = new AbortController();
      signal = settingsScope.signal;
      setSettingsTab(tab);
      setSettingsItems([]);
      setLoading(true);
      if (tab === 0) {
        // Account: server identity facts plus this device's sign-out. The
        // boards' Devices row needs account-wide revocation, which the
        // producer deliberately does not offer — the row stays absent.
        setSettingsItems([
          {
            id: "email",
            label: "Email",
            value: accountEmail() || "—",
            run: () => {},
          },
          {
            id: "logout",
            label: "Sign out of this TV",
            run: () =>
              openOverlay({
                kind: "confirm",
                title: "Sign out of this TV?",
                description:
                  "Your profiles, My List and progress stay on your account.",
                items: [
                  { id: "cancel", label: "Stay signed in", run: closeOverlay },
                  {
                    id: "confirm",
                    label: "Sign out",
                    run: async () => {
                      await player.stop();
                      await api.signOut();
                      resetScope();
                      clearProfileView();
                      setScreen("welcome");
                      setLoading(false);
                    },
                  },
                ],
              }),
          },
        ]);
        setLoading(false);
        return;
      }
      if (tab === 1) {
        const value = await api.profiles(signal);
        setManagement(value);
        setSettingsItems(
          value.profiles.map((profile, index) => ({
            id: profile.id,
            label: profile.name,
            value: profile.id === api.profile ? "Watching" : "",
            run: () => manageProfile(index),
          })),
        );
        setLoading(false);
        return;
      }
      const pref = await api.preferences(signal);
      setPreferences(pref);
      if (tab === 2 || tab === 3)
        setSettingsItems(
          (pref.controls ?? [])
            .filter(
              (control) =>
                control.group === (tab === 2 ? "playback" : "subtitles") &&
                control.choices,
            )
            .map((control) => {
              const choices = control.choices!;
              const isToggle =
                choices.length === 2 &&
                choices.every((choice) => typeof choice.value === "boolean");
              if (isToggle) {
                const on = pref.preferences[control.id] === true;
                const flip = async () => {
                  const previous = preferences()!;
                  const receipt = await call<Preferences>(
                    api.scoped("/preferences"),
                    "PUT",
                    {
                      revision: previous.revision,
                      preferences: {
                        ...previous.preferences,
                        [control.id]: !on,
                      },
                    },
                  );
                  setPreferences(receipt);
                  await loadSettings(settingsTab(), scope.signal);
                };
                return {
                  id: control.id,
                  label: control.label,
                  description: control.description,
                  toggle: on,
                  value: "",
                  run: flip,
                  cycle: flip,
                };
              }
              return {
                id: control.id,
                label: control.label,
                description: control.description,
                value:
                  choices.find(
                    (choice) => choice.value === pref.preferences[control.id],
                  )?.label ?? String(pref.preferences[control.id] ?? ""),
                chevron: true,
                run: () =>
                  preferenceChoice(
                    control.id,
                    control.label,
                    choices.map((choice) => [choice.label, choice.value]),
                  ),
              };
            }),
        );
      if (tab === 6)
        setSettingsItems(
          (pref.controls ?? [])
            .filter((control) => control.group === "display")
            .map((control) => displayItem(control, pref)),
        );
      if (tab === 4) {
        const [inventory, states] = await Promise.all([
          call<{ items: { id: number; name: string; enabled: boolean }[] }>(
            "/api/addons?limit=200",
            "GET",
            undefined,
            signal,
          ),
          call<{ addons: { connection_id: string; enabled: boolean }[] }>(
            api.scoped("/addon-activation"),
            "GET",
            undefined,
            signal,
          ),
        ]);
        setSettingsItems([
          {
            id: "add",
            label: "Add by address",
            run: () =>
              edit("Add-on address", async (address) => {
                const installed = await call<{ id: number }>(
                  "/api/addons",
                  "POST",
                  { manifest_url: address },
                );
                await call(api.scoped("/addon-activation"), "PUT", {
                  connection_id: `addon:${installed.id}`,
                  enabled: true,
                });
                closeOverlay();
                await loadSettings(tab, scope.signal);
              }),
          },
          ...inventory.items.map((addon) => {
            const state = states.addons.find(
              (item) => item.connection_id === `addon:${addon.id}`,
            );
            return {
              id: String(addon.id),
              label: addon.name,
              value: state
                ? state.enabled
                  ? "Enabled"
                  : "Disabled"
                : "Disabled for account",
              run: () =>
                openOverlay({
                  kind: "choices",
                  title: addon.name,
                  items: [
                    ...(state
                      ? [
                          {
                            id: "enabled",
                            label: state.enabled
                              ? "Disable for this profile"
                              : "Enable for this profile",
                            run: async () => {
                              await call(
                                api.scoped("/addon-activation"),
                                "PUT",
                                {
                                  connection_id: state.connection_id,
                                  enabled: !state.enabled,
                                },
                              );
                              closeOverlay();
                              await loadSettings(tab, scope.signal);
                            },
                          },
                        ]
                      : []),
                    {
                      id: "remove",
                      label: "Remove add-on",
                      run: () =>
                        openOverlay(
                          {
                            kind: "confirm",
                            title: `Remove ${addon.name}?`,
                            items: [
                              {
                                id: "cancel",
                                label: "Cancel",
                                run: dismissOverlay,
                              },
                              {
                                id: "remove",
                                label: "Remove",
                                run: async () => {
                                  await call(
                                    `/api/addons/${addon.id}`,
                                    "DELETE",
                                  );
                                  closeOverlay();
                                  await loadSettings(tab, scope.signal);
                                },
                              },
                            ],
                          },
                          true,
                        ),
                    },
                  ],
                }),
            };
          }),
        ]);
      }
      if (tab === 5) await loadIntegrations(signal);
      if (tab === 7) {
        const status = await call<{
          pin_configured: boolean;
          unlocked: boolean;
        }>("/api/parent/status", "GET", undefined, signal);
        const rows: Item[] = [];
        if (!status.pin_configured || !status.unlocked)
          rows.push({
            id: "unlock",
            label: status.pin_configured
              ? "Unlock parent controls"
              : "Set parent PIN",
            run: () =>
              edit(
                status.pin_configured ? "Parent PIN" : "Set parent PIN",
                async (pin) => {
                  await call(
                    status.pin_configured
                      ? "/api/parent/unlock"
                      : "/api/parent/pin",
                    status.pin_configured ? "POST" : "PUT",
                    { pin },
                  );
                  closeOverlay();
                  await refreshProfiles();
                  await loadSettings(tab, scope.signal);
                },
                "",
                true,
              ),
          });
        if (status.pin_configured)
          rows.push({
            id: "pin",
            label: "Change parent PIN",
            run: () =>
              edit(
                "Current parent PIN",
                async (current_pin) => {
                  edit(
                    "New parent PIN",
                    async (pin) => {
                      await call("/api/parent/pin", "PUT", {
                        current_pin,
                        pin,
                      });
                      closeOverlay();
                      await loadSettings(tab, scope.signal);
                    },
                    "",
                    true,
                  );
                },
                "",
                true,
              ),
          });
        if (status.unlocked)
          for (const profile of management()?.profiles ?? [])
            rows.push({
              id: profile.id,
              label: profile.name,
              description: "Manage this profile’s age limit",
              run: () => parentPolicy(profile.id, profile.name),
            });
        setSettingsItems(rows);
      }
      if (tab === 8)
        setSettingsItems([
          {
            id: "about",
            label: "VIPTV",
            value: "TV app",
            description: api.origin,
            run: () => {},
          },
        ]);
      setLoading(false);
    }
    async function parentPolicy(id: string, name: string) {
      const path = `/api/profiles/${segment(id)}/kids`;
      const policy = await call<{ enabled: boolean; max_age: number }>(path);
      openOverlay({
        kind: "choices",
        title: name,
        items: [
          {
            id: "enabled",
            label: "Kids profile",
            value: policy.enabled ? "On" : "Off",
            run: async () => {
              await call(path, "PUT", {
                enabled: !policy.enabled,
                max_age: policy.max_age,
              });
              closeOverlay();
              await refreshProfiles();
              await loadSettings(6, scope.signal);
            },
          },
          {
            id: "age",
            label: "Maximum age",
            value: String(policy.max_age),
            run: () =>
              edit(
                "Maximum age",
                async (value) => {
                  await call(path, "PUT", {
                    enabled: policy.enabled,
                    max_age: Number(value),
                  });
                  closeOverlay();
                  await parentPolicy(id, name);
                },
                String(policy.max_age),
              ),
          },
        ],
      });
    }
    async function loadIntegrations(signal: AbortSignal) {
      const value = await call<{
        revision: number;
        schemas: IntegrationSchema[];
      }>(api.scoped("/source-integrations"), "GET", undefined, signal);
      setSettingsItems(
        value.schemas
          .filter(
            (schema) =>
              schema.runtime_enabled && schema.state !== "Unavailable",
          )
          .map((schema) => ({
            id: schema.plugin_id,
            label: schema.name,
            value: schema.state === "Ready" ? "Connected" : "Set up",
            description: schema.saved_provider_count
              ? `${schema.saved_provider_count} providers`
              : undefined,
            run: () => integrationForm(schema, value.revision),
          })),
      );
    }
    function integrationForm(schema: IntegrationSchema, revision: number) {
      const draft: Record<string, string | string[]> = {};
      const openForm = () =>
        openOverlay({
          kind: "choices",
          title: schema.name,
          items: [
            ...schema.credential_fields.map((field) => ({
              id: field.id,
              label: field.label,
              value: draft[field.id]
                ? "Entered"
                : schema.state === "Ready"
                  ? "Saved"
                  : "",
              run: () =>
                edit(
                  field.label,
                  async (value) => {
                    draft[field.id] = value;
                    openForm();
                  },
                  "",
                  field.secret,
                ),
            })),
            ...(schema.provider_choices.length
              ? [
                  {
                    id: "providers",
                    label: "Providers",
                    value: `${(draft.providers as string[] | undefined)?.length ?? schema.saved_provider_count ?? 0} selected`,
                    run: () =>
                      openOverlay({
                        kind: "choices",
                        title: "Providers",
                        items: [
                          ...schema.provider_choices.map((provider) => ({
                            id: provider.id,
                            label: provider.label,
                            value: (
                              draft.providers as string[] | undefined
                            )?.includes(provider.id)
                              ? "✓"
                              : "",
                            run: () => {
                              const selected =
                                (draft.providers as string[] | undefined) ?? [];
                              draft.providers = selected.includes(provider.id)
                                ? selected.filter((id) => id !== provider.id)
                                : [...selected, provider.id].slice(
                                    -schema.maximum_providers,
                                  );
                              openForm();
                            },
                          })),
                          { id: "done", label: "Done", run: openForm },
                        ],
                      }),
                  },
                ]
              : []),
            {
              id: "save",
              label: "Save",
              run: async () => {
                await call(api.scoped("/source-integrations"), "PUT", {
                  revision,
                  plugin_id: schema.plugin_id,
                  configuration: draft,
                });
                closeOverlay();
                await loadSettings(4, scope.signal);
              },
            },
            ...(schema.connection_id
              ? [
                  {
                    id: "remove",
                    label: "Remove integration",
                    run: () =>
                      openOverlay({
                        kind: "confirm",
                        title: `Remove ${schema.name}?`,
                        items: [
                          { id: "cancel", label: "Cancel", run: openForm },
                          {
                            id: "remove",
                            label: "Remove",
                            run: async () => {
                              await call(
                                api.scoped(
                                  `/source-integrations/${segment(schema.connection_id!)}?revision=${revision}`,
                                ),
                                "DELETE",
                              );
                              closeOverlay();
                              await loadSettings(4, scope.signal);
                            },
                          },
                        ],
                      }),
                  },
                ]
              : []),
          ],
        });
      openForm();
    }
    async function refreshProfiles() {
      const value = await api.profiles(scope.signal);
      setManagement(value);
      if (screen() === "settings" && settingsTab() === 0)
        setSettingsItems(
          value.profiles.map((profile, index) => ({
            id: profile.id,
            label: profile.name,
            value: profile.id === api.profile ? "Watching" : "",
            run: () => manageProfile(index),
          })),
        );
    }
    function manageProfile(index: number) {
      const current = management()?.profiles[index];
      if (!current) return;
      const capabilities = management()?.capabilities;
      if (
        !available(capabilities?.rename) &&
        management()?.parent.pin_configured
      ) {
        edit(
          "Parent PIN",
          async (pin) => {
            await call("/api/parent/unlock", "POST", { pin });
            await refreshProfiles();
            manageProfile(index);
          },
          "",
          true,
        );
        return;
      }
      openOverlay({
        kind: "choices",
        title: "Edit profile",
        profile: current,
        items: [
          ...(available(capabilities?.rename)
            ? [
                {
                  id: "rename",
                  label: "Name",
                  value: current.name,
                  run: () =>
                    edit(
                      "Profile name",
                      async (name) => {
                        await call(
                          `/api/profiles/${segment(current.id)}`,
                          "PATCH",
                          { name },
                        );
                        await refreshProfiles();
                        dismissOverlay();
                      },
                      current.name,
                    ),
                },
              ]
            : []),
          ...(available(capabilities?.avatar)
            ? [
                {
                  id: "avatar",
                  label: "Change avatar",
                  run: () =>
                    openOverlay(
                      {
                        kind: "choices",
                        title: "Choose an avatar",
                        items: (management()?.avatar_ids ?? []).map((id) => ({
                          id,
                          label:
                            id === "initial-pink"
                              ? "Pink initial"
                              : id === "initial-blue"
                                ? "Blue initial"
                                : id,
                          run: async () => {
                            await call(
                              `/api/profiles/${segment(current.id)}`,
                              "PATCH",
                              { avatar_id: id },
                            );
                            await refreshProfiles();
                            dismissOverlay();
                          },
                        })),
                      },
                      true,
                    ),
                },
              ]
            : []),
          ...(current.can_delete && available(capabilities?.delete)
            ? [
                {
                  id: "delete",
                  label: "Delete profile",
                  run: () =>
                    openOverlay(
                      {
                        kind: "confirm",
                        title: `Delete ${current.name}?`,
                        items: [
                          {
                            id: "cancel",
                            label: "Cancel",
                            run: dismissOverlay,
                          },
                          {
                            id: "delete",
                            label: "Delete profile",
                            run: async () => {
                              await call(
                                `/api/profiles/${segment(current.id)}`,
                                "DELETE",
                              );
                              await refreshProfiles();
                              closeOverlay();
                            },
                          },
                        ],
                      },
                      true,
                    ),
                },
              ]
            : []),
        ],
      });
    }
    async function selectProfile(index: number) {
      const profile = management()?.profiles[index];
      if (!profile) {
        if (!available(management()?.capabilities.create)) {
          await run(refreshProfiles);
          return;
        }
        edit("Profile name", async (name) => {
          await call("/api/profiles", "POST", { name });
          await refreshProfiles();
          closeOverlay();
        });
        return;
      }
      if (profile.selection_requires_parent) {
        edit(
          "Parent PIN",
          async (pin) => {
            await call("/api/parent/unlock", "POST", { pin });
            await refreshProfiles();
            closeOverlay();
            await selectProfile(index);
          },
          "",
          true,
        );
        return;
      }
      await run(async () => {
        await player.stop();
        resetScope();
        history.length = 0;
        setHome(undefined);
        setPage({ cards: [], complete: true });
        setDetail(undefined);
        setPrograms({});
        applyBootstrap(await api.selectProfile(profile.id, scope.signal));
      });
    }
    function move(dx: number, dy: number) {
      channelPending = undefined;
      if (screen() === "pairing") {
        setPairingFocused(true);
        return;
      }
      if (screen() === "signed-in") {
        // The confirmation exposes a single focusable acknowledgement; Left and
        // Right still move the reported focus for remote-parity without acting.
        if (dx) setColumn((i) => Math.max(0, Math.min(1, i + dx)));
        return;
      }
      if (overlayClosing() || error()) return;
      pendingFocus = undefined;
      resetHeroCycle();
      if (loading() && screen() === "welcome") return;
      if (overlay()) {
        const value = overlay()!;
        if (
          (value.kind === "choices" || value.kind === "confirm") &&
          value.profile
        ) {
          const avatar = value.items.findIndex((item) => item.id === "avatar"),
            right = value.items
              .map((_, index) => index)
              .filter((index) => index !== avatar);
          if (dx < 0 && avatar >= 0) setChoice(avatar);
          else if (dx > 0) setChoice(right[0] ?? avatar);
          else if (dy) {
            const index = right.indexOf(choice());
            setChoice(
              right[Math.max(0, Math.min(right.length - 1, index + dy))] ??
                avatar,
            );
          }
          return;
        }
        if (value.kind === "tracks") {
          if (dx) {
            setTrackColumn((i) =>
              Math.max(0, Math.min(value.columns.length - 1, i + dx)),
            );
            setChoice(0);
          } else
            setChoice((i) =>
              Math.max(
                0,
                Math.min(value.columns[trackColumn()].items.length - 1, i + dy),
              ),
            );
          return;
        }
        if (value.kind === "sources") {
          manualSourceSelection = true;
          if (sourceFilterFocus()) {
            if (dy > 0) setSourceFilterFocus(false);
            else
              setSourceFacet((i) =>
                Math.max(
                  0,
                  Math.min(sourcePage()?.quality_filters?.length ?? 0, i + dx),
                ),
              );
          } else if (
            dy < 0 &&
            choice() === 0 &&
            (sourcePage()?.quality_filters?.length ?? 0) > 0
          ) {
            setSourceFilterFocus(true);
            setSourceFacet(
              sourceHeight() === undefined
                ? 0
                : Math.max(
                    0,
                    (sourcePage()?.quality_filters ?? []).findIndex(
                      (filter) => filter.height === sourceHeight(),
                    ) + 1,
                  ),
            );
          } else
            setChoice((i) =>
              Math.max(0, Math.min(sources().length - 1, i + dy)),
            );
          return;
        }
        if (value.kind === "calibration") {
          if (dx) {
            const next = Math.max(
              value.min,
              Math.min(value.max, calibrationValue() + dx),
            );
            setCalibrationValue(next);
            applyScreenInset(next);
          }
          return;
        }
        if (value.kind === "text") {
          setKey((i) =>
            Math.max(
              0,
              Math.min(
                value.numeric ? 11 : 47,
                i + dx + dy * (value.numeric ? 3 : 6),
              ),
            ),
          );
        } else
          setChoice((i) =>
            Math.max(0, Math.min(value.items.length - 1, i + dy)),
          );
        return;
      }
      if (screen() === "player") {
        setShowControls(true);
        hideControls();
        if (dx && choice() > 0) {
          setChoice((i) =>
            Math.max(1, Math.min(playerButtons().length - 1, i + dx)),
          );
        } else if (dx && playerActions().seek) {
          setSeek(
            Math.max(
              0,
              Math.min(
                snapshot()?.time.durationSeconds ?? 0,
                (seek() ?? snapshot()?.time.positionSeconds ?? 0) + dx * 10,
              ),
            ),
          );
        }
        if (dy < 0) setChoice(playerButtons().length > 1 ? 1 : 0);
        if (dy > 0) setChoice(0);
        return;
      }
      if (screen() === "profiles") {
        if (dy > 0) {
          if (canManageProfiles()) setZone("profile-manage");
          return;
        }
        if (dy < 0) {
          setZone("profiles");
          return;
        }
        setColumn((i) =>
          Math.max(
            0,
            Math.min(
              (management()?.profiles.length ?? 0) -
                (available(management()?.capabilities.create) ? 0 : 1),
              i + dx,
            ),
          ),
        );
        return;
      }
      if (zone() === "nav") {
        setColumn((i) => Math.max(0, Math.min(navs().length - 1, i + dx)));
        if (dy > 0) {
          setColumn(0);
          setZone(
            screen() === "home" || screen() === "detail"
              ? "hero"
              : screen() === "settings"
                ? "settings-nav"
                : screen() === "search"
                  ? "keyboard"
                  : screen() === "library" && libraryControlCount()
                    ? "library-controls"
                    : "content",
          );
        }
        return;
      }
      if (screen() === "settings") {
        if (zone() === "settings-nav") {
          if (dy < 0 && settingsTab() === 0) return;
          if (dy) {
            const next = Math.max(
              0,
              Math.min(settingsTabs.length - 1, settingsTab() + dy),
            );
            void loadSettings(next, scope.signal).catch(fail);
          }
          if (dx > 0) {
            setZone("settings-content");
            setColumn(0);
          }
        } else {
          // Inline display controls (swatches, toggles) own Left/Right while
          // focused; every adjustment is a confirmed server write.
          const item = settingsItems()[column()];
          if (dx && item?.cycle) {
            void Promise.resolve(item.cycle(dx)).catch(fail);
            return;
          }
          if (dx < 0) setZone("settings-nav");
          setColumn((i) =>
            Math.max(0, Math.min(settingsItems().length - 1, i + dy)),
          );
        }
        return;
      }
      if (screen() === "detail" && zone() === "seasons") {
        setColumn((i) =>
          Math.max(0, Math.min((detail()?.seasons.length ?? 1) - 1, i + dx)),
        );
        if (dy < 0) {
          setZone("hero");
          setColumn(0);
        }
        if (dy > 0) {
          setZone("episodes");
          setColumn(0);
        }
        return;
      }
      if (screen() === "detail" && zone() === "episodes") {
        if (dy < 0) {
          setZone(detail()?.seasons.length ? "seasons" : "hero");
          setColumn(seasonIndex());
          return;
        }
        if (
          dy > 0 &&
          detail()?.episodes.length &&
          detail()?.recommendations.length
        ) {
          setZone("recommendations");
          setColumn(0);
          return;
        }
        const items = detail()?.episodes.length
          ? detail()!.episodes
          : (detail()?.recommendations ?? []);
        moveToItem(
          column() + dx,
          items.length,
          detail()?.episodes.length ? detail()?.next_cursor : undefined,
        );
        if (column() >= items.length - 4) void more();
        return;
      }
      if (screen() === "detail" && zone() === "recommendations") {
        if (dy < 0) {
          setZone("episodes");
          setColumn(0);
          return;
        }
        setColumn((i) =>
          Math.max(
            0,
            Math.min((detail()?.recommendations.length ?? 1) - 1, i + dx),
          ),
        );
        return;
      }
      if (zone() === "hero") {
        setHeroAction((i) =>
          Math.max(0, Math.min(screen() === "home" ? 2 : 3, i + dx)),
        );
        if (dy < 0 && screen() !== "detail") {
          setZone("nav");
          setColumn(navIndex("home"));
        }
        if (dy > 0) {
          if (screen() === "home") {
            const first =
              home()?.rows.findIndex(
                (shelf) => shelf.cards.length > 0 || shelf.state === "Failed",
              ) ?? -1;
            if (first < 0) return;
            setRow(first);
            setZone("rows");
          } else {
            if (!detail()?.episodes.length && !detail()?.recommendations.length)
              return;
            setZone("episodes");
            setRow(0);
          }
          setColumn(0);
        }
        return;
      }
      if (screen() === "home" && zone() === "rows") {
        if (dy < 0 && row() === 0) {
          setZone("hero");
          return;
        }
        if (dy) {
          const rows = home()?.rows ?? [];
          let next = row() + dy;
          while (
            next >= 0 &&
            next < rows.length &&
            !rows[next].cards.length &&
            rows[next].state !== "Failed"
          )
            next += dy;
          if (next < 0) {
            setZone("hero");
            return;
          }
          if (next >= rows.length) return;
          setRow(next);
        }
        const cards = home()?.rows[row()]?.cards ?? [];
        moveToItem(
          dy ? 0 : column() + dx,
          cards.length,
          home()?.rows[row()]?.next_cursor,
        );
        void loadHomePage();
        return;
      }
      if (screen() === "search" && zone() === "keyboard") {
        const index = key(),
          col = index < 2 ? index * 3 : (index - 2) % 6;
        if (dy < 0 && index < 2) {
          setZone("nav");
          setColumn(navIndex("search"));
        } else if (
          dx > 0 &&
          (index === 1 || col === 5) &&
          (page().cards.length ||
            searchChannels().length ||
            searchError() ||
            searchChannelError())
        ) {
          setZone(
            page().cards.length
              ? "content"
              : searchChannels().length
                ? "search-channels"
                : searchError()
                  ? "search-retry"
                  : "search-channel-retry",
          );
          setColumn(0);
        } else if (index < 2) {
          if (dy > 0) setKey(2 + index * 3);
          else if (dx) setKey(Math.max(0, Math.min(1, index + dx)));
        } else if (dy < 0 && index < 8) setKey(col < 3 ? 0 : 1);
        else if (dy) setKey(Math.max(2, Math.min(37, index + dy * 6)));
        else if (dx && col + dx >= 0 && col + dx < 6) setKey(index + dx);
        return;
      }
      if (
        screen() === "search" &&
        ["search-retry", "search-channel-retry"].includes(zone())
      ) {
        if (dx < 0) setZone("keyboard");
        if (dy < 0) {
          if (zone() === "search-channel-retry" && searchError())
            setZone("search-retry");
          else {
            setZone("nav");
            setColumn(navIndex("search"));
          }
        }
        if (dy > 0) {
          if (zone() === "search-retry" && page().cards.length) {
            setZone("content");
            setColumn(Math.min(searchMediaFocus, page().cards.length - 1));
          } else if (searchChannels().length) {
            setZone("search-channels");
            setColumn(
              Math.min(searchChannelFocus, searchChannels().length - 1),
            );
          } else if (searchChannelError()) setZone("search-channel-retry");
        }
        return;
      }
      if (screen() === "search" && zone() === "search-channels") {
        searchChannelFocus = column();
        if (dy < 0) {
          setZone(
            searchChannelError()
              ? "search-channel-retry"
              : page().cards.length
                ? "content"
                : searchError()
                  ? "search-retry"
                  : "keyboard",
          );
          setColumn(
            Math.min(searchMediaFocus, Math.max(0, page().cards.length - 1)),
          );
        } else if (dx) moveChannel(dx, true);
        return;
      }
      if (
        screen() === "search" &&
        zone() === "content" &&
        searchCapabilities().channels
      ) {
        searchMediaFocus = column();
        if (dy > 0) {
          if (searchChannels().length) {
            setZone("search-channels");
            setColumn(
              Math.min(searchChannelFocus, searchChannels().length - 1),
            );
          } else if (searchChannelError()) setZone("search-channel-retry");
        } else if (dy < 0) {
          setZone(searchNeedsRetry() ? "search-retry" : "nav");
          setColumn(navIndex("search"));
        } else if (dx < 0 && column() === 0) setZone("keyboard");
        else {
          moveToItem(column() + dx, page().cards.length);
          searchMediaFocus = column();
        }
        return;
      }

      if (screen() === "live" && zone() === "live-groups") {
        if (dy > 0) {
          setZone("content");
          setColumn(0);
        } else if (dy < 0) {
          setZone("nav");
          setColumn(navIndex("live"));
        } else setColumn((i) => Math.max(0, Math.min(groups().length, i + dx)));
        return;
      }
      if (screen() === "live" && zone() === "content") {
        if (dx) {
          setProgramIndex((i) =>
            Math.max(
              0,
              Math.min(
                (programs()[channels()[column()]?.id]?.length ?? 1) - 1,
                i + dx,
              ),
            ),
          );
          return;
        }
        if (dy) moveChannel(dy, false);
        return;
      }
      if (zone() === "library-controls") {
        if (dy < 0) {
          setZone("nav");
          setColumn(navIndex("library"));
        } else if (dy > 0) {
          setZone("content");
          setColumn(0);
        } else
          setColumn((i) =>
            Math.max(0, Math.min(libraryControlCount() - 1, i + dx)),
          );
        return;
      }
      if (zone() === "filters") {
        if (dy < 0) {
          setZone("nav");
          setColumn(navIndex(screen()));
        } else if (dy > 0) {
          setZone("content");
          setColumn(0);
        } else
          setColumn((i) =>
            Math.max(
              0,
              Math.min((catalog()?.controls.length ?? 0) > 0 ? 1 : 0, i + dx),
            ),
          );
        return;
      }
      const items =
        screen() === "detail"
          ? detail()?.episodes.length
            ? detail()!.episodes
            : (detail()?.recommendations ?? [])
          : page().cards;
      const columns =
        screen() === "live"
          ? 1
          : screen() === "search"
            ? 5
            : screen() === "detail"
              ? 4
              : 7;
      if (dy < 0 && column() < columns) {
        if (screen() === "search") searchMediaFocus = column();
        const targetZone =
          screen() === "detail"
            ? "hero"
            : screen() === "movie" || screen() === "series"
              ? "filters"
              : screen() === "library" && libraryControlCount()
                ? "library-controls"
                : screen() === "search" && searchNeedsRetry()
                  ? "search-retry"
                  : "nav";
        setZone(targetZone);
        setColumn(targetZone === "nav" ? navIndex(screen()) : 0);
        return;
      }
      if (screen() === "search" && dx < 0 && column() % 5 === 0) {
        searchMediaFocus = column();
        setZone("keyboard");
        return;
      }
      moveToItem(
        column() + dx + dy * columns,
        items.length,
        page().next_cursor,
      );
      if (screen() === "live") void loadGuide(column());
      if (column() >= items.length - columns * 2) void more();
    }
    async function loadHomePage() {
      const generation = pageGeneration;
      const current = home()?.rows[row()];
      if (
        !current?.next_cursor ||
        !current.browse ||
        current.browse.target !== "Discover" ||
        pageBusy ||
        column() < current.cards.length - 5
      )
        return;
      pageBusy = true;
      const identityFields = new Set([
        "type",
        "catalog",
        "connection_id",
        "addon_id",
      ]);
      const values = {
        ...Object.fromEntries(
          current.browse.query
            .filter((field) => identityFields.has(field.id))
            .map((field) => [field.id, field.values[0]]),
        ),
        values: current.browse.query.filter(
          (field) => !identityFields.has(field.id),
        ),
      };
      try {
        const result = await api.discover(
          { ...values, skip: current.next_cursor },
          pageSignal(),
        );
        if (generation !== pageGeneration) return;
        setHome((old) =>
          old
            ? {
                ...old,
                rows: old.rows.map((r) =>
                  r.id === current.id
                    ? {
                        ...r,
                        cards: [...r.cards, ...result.cards],
                        next_cursor: result.next_cursor,
                      }
                    : r,
                ),
              }
            : old,
        );
      } catch (e) {
        if (generation === pageGeneration) {
          pendingFocus = undefined;
          fail(e);
        }
      } finally {
        if (generation === pageGeneration) {
          pageBusy = false;
          settlePendingFocus();
        }
      }
    }
    function keyboardActivate(isOverlay: boolean) {
      const index = key();
      const modal = overlay();
      if (isOverlay && modal?.kind === "text" && modal.numeric) {
        if (index === 11) void run(() => modal.submit(text()));
        else if (index === 9) setText((value) => value.slice(0, -1));
        else
          setText((value) =>
            (value + (index === 10 ? "0" : String(index + 1))).slice(0, 8),
          );
        return;
      }
      if (index === 42) {
        setKeyboardUpper((value) => !value);
        return;
      }
      if (index === 45) {
        setKeyboardSymbols((value) => !value);
        return;
      }
      if (index === 46) {
        if (isOverlay && modal?.kind === "text")
          void run(() => modal.submit(text()));
        else {
          setZone("content");
          setColumn(0);
        }
        return;
      }
      if (index === 47) {
        if (isOverlay) dismissOverlay();
        else updateSearch("");
        return;
      }
      const value = isOverlay ? text() : search();
      const next =
        index < 42
          ? value + keyboardCharacters()[index]
          : index === 43
            ? value + " "
            : index === 44
              ? Array.from(value).slice(0, -1).join("")
              : value;
      if (isOverlay) setText(next.slice(0, 2048));
      else updateSearch(next);
    }
    async function activate() {
      channelPending = undefined;
      resetHeroCycle();
      const canLeaveLoading =
        !overlay() &&
        ((zone() === "nav" && !["welcome", "pairing"].includes(screen())) ||
          (screen() === "search" && zone() === "keyboard"));
      if (pending() || overlayClosing() || (loading() && !canLeaveLoading))
        return;
      if (error()) {
        setError("");
        retry();
        return;
      }
      const modal = overlay();
      if (modal) {
        if (modal.kind === "tracks") {
          await run(async () => {
            await modal.columns[trackColumn()].items[choice()]?.run();
          });
          return;
        }
        if (modal.kind === "calibration") {
          await run(async () => {
            await modal.save(calibrationValue());
          });
          closeOverlay();
          return;
        }
        if (modal.kind === "text") keyboardActivate(true);
        else if (modal.kind === "sources") {
          if (sourceFilterFocus()) {
            const height =
              sourcePage()?.quality_filters?.[sourceFacet() - 1]?.height;
            setSourceHeight(height);
            manualSourceSelection = true;
            setSourceFiltering(true);
            const ticket = ++sourceFilterGeneration,
              signal = sourceScope?.signal ?? scope.signal;
            try {
              const result = await api.rankSources(
                allSourceIds(),
                height,
                signal,
              );
              if (ticket === sourceFilterGeneration && !signal.aborted) {
                setSourcePage(result);
                setSources(result.streams);
                setChoice(0);
                setSourceFilterFocus(false);
              }
            } finally {
              if (ticket === sourceFilterGeneration) setSourceFiltering(false);
            }
            return;
          }
          if (sourceFiltering()) return;
          const source = sources()[choice()];
          if (source) await playSource(source);
        } else
          await run(async () => {
            await modal.items[choice()]?.run();
          });
        return;
      }
      if (screen() === "welcome" || screen() === "pairing") {
        await beginPairing();
        return;
      }
      if (screen() === "signed-in") {
        finishSignIn();
        return;
      }
      if (screen() === "profiles") {
        if (zone() === "profile-manage") {
          manageProfile(
            Math.min(column(), (management()?.profiles.length ?? 1) - 1),
          );
          return;
        }
        await selectProfile(column());
        return;
      }
      if (screen() === "player") {
        if (seek() !== undefined) {
          const position = seek()!;
          setSeek(undefined);
          if (!playerActions().seek) return;
          await player.start(
            activeAction()!.card,
            activeSource()!,
            false,
            position,
          );
          return;
        }
        const control = playerButtons()[choice()]?.id;
        if (
          snapshot()?.state === "ended" &&
          control === "timeline" &&
          !playerActions().next_episode
        ) {
          if (playerActions().restart)
            await player.start(activeAction()!.card, activeSource()!, false, 0);
          return;
        }
        if (
          playerActions().next_episode &&
          ((snapshot()?.state === "ended" && control === "timeline") ||
            control === "next")
        ) {
          const next = await api.next(activeAction()!.card, scope.signal);
          if (next.item) await playIntent(next.item);
          else notify("You’re all caught up.");
        } else if (control === "tracks") {
          openTracks();
        } else if (control === "sources") {
          await playIntent(
            activeAction()!.card,
            true,
            false,
            activeChannel(),
            true,
          );
        } else if (control === "episodes") {
          const result = await api.detail(
            activeAction()!.card,
            "0",
            scope.signal,
          );
          openOverlay({
            kind: "choices",
            title: "Episodes",
            items: result.episodes.map((card) => ({
              id: card.identity.id,
              label: card.subtitle ?? card.title,
              run: () => playIntent(card),
            })),
          });
        } else if (control === "timeline" && playerActions().pause) {
          if (snapshot()?.state === "playing") await player.player.pause();
          else await player.player.play();
        }
        return;
      }
      if (zone() === "nav") {
        const nav = navs()[column()];
        if (!nav) return;
        if (nav.id === "profiles")
          openOverlay({
            kind: "choices",
            title: "Your profile",
            items: [
              {
                id: "profiles",
                label: "Switch profile",
                run: async () => {
                  closeOverlay();
                  await navigate("profiles");
                },
              },
              {
                id: "settings",
                label: "Settings",
                run: async () => {
                  closeOverlay();
                  await navigate("settings");
                },
              },
            ],
          });
        else await navigate(nav.id);
        return;
      }
      if (screen() === "settings") {
        if (zone() === "settings-nav") {
          setZone("settings-content");
          setColumn(0);
        } else
          await run(async () => {
            await settingsItems()[column()]?.run();
          });
        return;
      }
      if (screen() === "detail" && zone() === "seasons") {
        const index = column(),
          season = detail()?.seasons[index],
          card = detail()?.item;
        if (!season || !card) return;
        await run(async () => {
          const value = await api.detail(
            card,
            String(season.offset),
            restartPaging(),
          );
          setDetail(value);
          setSeasonIndex(index);
          setColumn(0);
          setZone("episodes");
        });
        return;
      }
      if (screen() === "search" && zone() === "keyboard") {
        const index = key();
        updateSearch(
          index === 0
            ? search() + " "
            : index === 1
              ? Array.from(search()).slice(0, -1).join("")
              : search() + searchLetters[index - 2],
        );
        return;
      }
      if (
        screen() === "search" &&
        ["search-retry", "search-channel-retry"].includes(zone())
      ) {
        if (zone() === "search-channel-retry" && channelRetry) {
          const direction = channelRetry;
          setZone("search-channels");
          setColumn(searchChannelFocus);
          await moreChannels(direction);
          return;
        }
        setZone("keyboard");
        updateSearch(search(), true);
        return;
      }
      if (screen() === "search" && zone() === "search-channels") {
        const channel = searchChannels()[column()];
        if (channel) await playIntent(channel.card, false, false, channel.id);
        return;
      }
      if (zone() === "library-controls") {
        const item = libraryTypes()[column()];
        if (item)
          await run(() =>
            applyLibrary({ ...library()?.query, type: item.value }),
          );
        else if (librarySort()) chooseLibrary(librarySort()!);
        else libraryFilterDialog();
        return;
      }
      if (zone() === "filters") {
        if (column() === 0)
          openOverlay({
            kind: "choices",
            title: "Choose a catalog",
            items: (controls()?.catalogs ?? []).map((c) => ({
              id: c.id,
              label: c.name,
              description: c.connection_name,
              run: async () => {
                setCatalog(c);
                setFilters({});
                closeOverlay();
                await loadBrowse();
              },
            })),
          });
        else
          openOverlay({
            kind: "choices",
            title: "Filters",
            items: (catalog()?.controls ?? []).map((control) => ({
              id: control.id,
              label: control.label,
              value: (filters()[control.id] ?? [])
                .map(
                  (value) =>
                    control.choices.find((choice) => choice.value === value)
                      ?.label ?? value,
                )
                .join(", "),
              run: () => {
                if (control.choices.length) filtersOverlay(control);
                else
                  edit(control.label, async (value) => {
                    setFilters((old) => ({ ...old, [control.id]: [value] }));
                    closeOverlay();
                    await loadBrowse();
                  });
              },
            })),
          });
        return;
      }
      if (
        screen() === "home" &&
        zone() === "rows" &&
        home()?.rows[row()]?.state === "Failed"
      ) {
        setHome(await api.home(scope.signal));
        return;
      }
      if (zone() === "hero") {
        const card = hero();
        if (!card) {
          if (screen() === "home" && home()?.complete)
            await navigate("settings");
          return;
        }
        if (heroAction() === 0) await playIntent(card);
        else if (heroAction() === 1) await toggleSaved(card);
        else if (heroAction() === 2) {
          if (screen() === "home") await openDetail(card);
          else {
            setZone("episodes");
            setColumn(0);
          }
        } else await playIntent(card, true);
        return;
      }
      if (screen() === "live" && zone() === "live-groups") {
        const group = column() ? groups()[column() - 1]?.id : undefined;
        await loadLiveGroup(group);
        return;
      }
      if (screen() === "live") {
        const channel = channels()[column()];
        if (channel) await playIntent(channel.card, false, false, channel.id);
        return;
      }
      const card =
        screen() === "detail"
          ? zone() === "recommendations"
            ? detail()?.recommendations[column()]
            : detail()?.episodes.length
              ? detail()!.episodes[column()]
              : detail()?.recommendations[column()]
          : screen() === "home"
            ? home()?.rows[row()]?.cards[column()]
            : page().cards[column()];
      if (card) {
        if (
          (screen() === "detail" && card.identity.episode) ||
          (screen() === "home" && card.view?.preview?.action === "play")
        )
          await playIntent(card);
        else await openDetail(card);
      }
    }
    function pressTarget(){
      const modal=overlay();
      if(modal?.kind==='sources')return JSON.stringify(['sources',sourceFilterFocus()?['filter',sourcePage()?.quality_filters?.[sourceFacet()-1]?.height]:['source',sources()[choice()]?.id],selected()?cardKey(selected()!):null]);
      if(modal)return JSON.stringify([modal.kind,modal.kind==='text'?key():choice()]);
      // The hero term identifies the billboard only while the billboard is the
      // focused element. On a rows card the hero is the delayed preview, which
      // changes 400ms into a hold and would otherwise defeat the 700ms timer.
      return JSON.stringify([screen(),zone(),column(),row(),heroAction(),zone()==="hero"?(hero()?cardKey(hero()!):null):null,focusedCard()?cardKey(focusedCard()!):null,heroAction()===1&&hero()?isSaved(hero()!):null]);
    }
    function menu() {
      if (overlay()) {
        if (overlay()?.kind === "sources") manualSourceSelection = true;
        return;
      }
      if (screen() === "settings") {
        if (zone() === "settings-content")
          void Promise.resolve(settingsItems()[column()]?.run()).catch(fail);
        return;
      }
      const channel =
        screen() === "live" && zone() === "content"
          ? channels()[column()]
          : screen() === "search" && zone() === "search-channels"
            ? searchChannels()[column()]
            : undefined;
      if (channel) {
        void call<{ channel_ids: string[] }>(api.scoped("/live/favorites"))
          .then((value) => {
            const saved = value.channel_ids.includes(channel.id);
            setLiveFavorites(new Set(value.channel_ids));
            openOverlay({
              kind: "choices",
              title: channel.card.title,
              items: [
                {
                  id: "play",
                  label: "Watch live",
                  run: () => playIntent(channel.card, false, false, channel.id),
                },
                {
                  id: "favorite",
                  label: saved ? "Remove from favourites" : "Add to favourites",
                  run: async () => {
                    const receipt = await call<{ channel_ids: string[] }>(
                      api.scoped(`/live/${segment(channel.id)}/favorite`),
                      saved ? "DELETE" : "PUT",
                      {},
                    );
                    setLiveFavorites(new Set(receipt.channel_ids));
                    closeOverlay();
                  },
                },
              ],
            });
          })
          .catch(fail);
        return;
      }
      if (screen() === "profiles") {
        if (canManageProfiles()) manageProfile(column());
        return;
      }
      if (["nav", "filters", "keyboard", "seasons"].includes(zone())) return;
      const card = zone() === "hero" ? hero() : focusedCard();
      if (card)
        openOverlay({
          kind: "choices",
          title: card.title,
          items: [
            {
              id: "detail",
              label: "More information",
              run: async () => {
                closeOverlay();
                await openDetail(card);
              },
            },
            {
              id: "sources",
              label: "Choose a source",
              run: () => playIntent(card, true),
            },
            {
              id: "restart",
              label: "Play from start",
              run: () => playIntent(card, false, true),
            },
            {
              id: "save",
              label: isSaved(card) ? "Remove from My List" : "Add to My List",
              run: () => toggleSaved(card),
            },
          ],
        });
    }
    createEffect(() => {
      const state = screen();
      document.documentElement.dataset.tvScreen = state;
      document.documentElement.dataset.tvNavigation = navs()
        .map((item) => item.id)
        .join(",");
      document.documentElement.dataset.tvOverlay = overlay()?.kind ?? "";
      document.documentElement.dataset.tvSources=String(sources().length);
      document.documentElement.dataset.tvSources = String(sources().length);
      document.documentElement.dataset.tvSources = String(sources().length);
      document.documentElement.dataset.tvReady = String(
        !loading() && !pending(),
      );
      document.documentElement.dataset.tvChannelId =
        (state === "live" && zone() === "content"
          ? channels()[column()]
          : state === "search" && zone() === "search-channels"
            ? searchChannels()[column()]
            : undefined
        )?.id ?? "";
      document.documentElement.dataset.tvFocus =
        zone() === "confirmation"
          ? `confirmation:${row()}:${column()}`
          : `${zone()}:${column()}:${row()}:${heroAction()}:${choice()}`;
      document.documentElement.dataset.tvSaver = String(screenSaver());
      if (state !== "player")
        document.getElementById("video-layer")!.style.display = "none";
    });
    createEffect(() => {
      const show = screen() === "player" && loading();
      const spinner = document.getElementById("solid-preparing-spinner");
      const timer = setTimeout(() => {
        if (show && spinner) spinner.style.display = "block";
      }, 500);
      onCleanup(() => {
        clearTimeout(timer);
        if (spinner) spinner.style.display = "none";
      });
    });
    createEffect(() => {
      snapshot(); // Decoder lease updates trigger the appearance effect.
      const override = captionOverride();
      const appearance =
        override?.leaseId === player.leaseId
          ? override?.appearance
          : player.subtitleAppearance;
      const preferencesValue = preferences()?.preferences;
      let style = document.getElementById("tv-caption-style");
      if (!style) {
        style = document.createElement("style");
        style.id = "tv-caption-style";
        document.head.append(style);
      }
      style.textContent = `#tv-video::cue { font-size: ${2.2 * Number(appearance?.font_scale ?? preferencesValue?.subtitle_font_scale ?? 1)}vw; color: ${String(appearance?.text_color ?? preferencesValue?.subtitle_text_color ?? "#FFFFFF")}; background-color: ${String(appearance?.background_color ?? preferencesValue?.subtitle_background_color ?? "#00000000")}; }`;
      onCleanup(() => style?.remove());
    });
    onMount(() => {
      void start();
      const input = (event: KeyboardEvent) => {
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        if (
          screen() === "player" &&
          (event.key === "MediaStop" || event.keyCode === 413)
        ) {
          event.preventDefault();
          if (!event.repeat) void leavePlayer().catch(fail);
          return;
        }
        if (screen() === "player" && !overlay()) {
          if (
            ["MediaPlayPause", "MediaPlay", "MediaPause", " "].includes(
              event.key,
            ) ||
            [10252, 415, 19].includes(event.keyCode)
          ) {
            event.preventDefault();
            if (event.repeat || !playerActions().pause) return;
            const play =
              event.key === "MediaPlay" ||
              event.keyCode === 415 ||
              (!(["MediaPause"].includes(event.key) || event.keyCode === 19) &&
                snapshot()?.state !== "playing");
            void (play ? player.player.play() : player.player.pause()).catch(
              fail,
            );
            return;
          }
          if (
            ["MediaFastForward", "MediaRewind"].includes(event.key) ||
            [412, 417].includes(event.keyCode)
          ) {
            event.preventDefault();
            if (!playerActions().seek) return;
            setChoice(0);
            move(
              event.key === "MediaRewind" || event.keyCode === 412 ? -1 : 1,
              0,
            );
            return;
          }
        }
        if (
          (overlay()?.kind === "text" ||
            (screen() === "search" && zone() === "keyboard")) &&
          event.key.length === 1
        ) {
          event.preventDefault();
          if (overlay()?.kind === "text")
            setText((value) => (value + event.key).slice(0, 2048));
          else updateSearch(search() + event.key);
        }
      };
      const cancelHold = () => clearTimeout(holdTimer);
      const suspend = () => {
        cancelHold();
        if (screen() === "player") void leavePlayer().catch(fail);
      };
      const visibility = () => {
        guideClock = undefined;
        setHeroVisible(document.visibilityState === "visible");
        if (document.visibilityState !== "visible") suspend();
      };
      const relaunch = () => window.focus();
      window.addEventListener("blur", cancelHold);
      window.addEventListener("keydown", input);
      window.addEventListener("pagehide", suspend);
      document.addEventListener("visibilitychange", visibility);
      document.addEventListener("webOSRelaunch", relaunch);
      onCleanup(() => {
        window.removeEventListener("keydown", input);
        window.removeEventListener("blur", cancelHold);
        window.removeEventListener("pagehide", suspend);
        document.removeEventListener("visibilitychange", visibility);
        document.removeEventListener("webOSRelaunch", relaunch);
        clearTimeout(holdTimer);
      });
    });
    onCleanup(() => {
      alive = false;
      clearTimeout(holdTimer);
      clearTimeout(overlayTimer);
      cancelAnimationFrame(overlayFrame);
      scope.abort();
      settingsScope?.abort();
      sourceScope?.abort();
      clearTimeout(revisionTimer);
      clearTimeout(noticeTimer);
      clearTimeout(searchTimer);
      clearTimeout(controlsTimer);
      void player.dispose();
    });
    function Tile(props: {
      card: Card;
      x: number;
      y: number;
      w: number;
      h: number;
      focused: boolean;
      poster?: boolean;
      library?: boolean;
      home?: boolean;
    }) {
      // One tiny blur per mounted tile/artwork. Retired row windows release it;
      // focus changes reuse pixels without repeating canvas readback.
      const playArt = createMemo(() => ({
        src: props.poster ? props.card.poster : props.card.landscape,
        width: props.w,
        height: props.h,
      }));
      const badgeWidth = createMemo(() => {
        const context = document.createElement("canvas").getContext("2d")!;
        context.font = `${props.library || props.home ? 18 : 20}px Onest700`;
        return Math.min(
          props.w - 24,
          Math.ceil(
            context.measureText(props.card.view?.tile_badge?.label ?? "").width,
          ) + 20,
        );
      });
      return (
        <TvView x={props.x} y={props.y} w={props.w} h={props.h + 64}>
          <TvView
            show={!props.library && !props.home}
            x={-4}
            y={-4}
            w={props.w + 8}
            h={props.h + 8}
            rounded={12}
            color={props.focused ? palette.text : "rgba(0,0,0,0)"}
          />
          <TvView
            w={props.w}
            h={props.h}
            rounded={10}
            color={palette.surface}
            clipping={true}
          >
            <Show
              when={props.poster ? props.card.poster : props.card.landscape}
            >
              <TvView
                w={props.w}
                h={props.h}
                rounded={10}
                src={(props.poster ? props.card.poster : props.card.landscape)!}
                fit="cover"
              />
            </Show>
            <Show when={props.card.progress != null}>
              <Show
                when={props.home}
                fallback={
                  <>
                    <TvView
                      x={0}
                      y={props.h - (props.home ? 4 : 5)}
                      w={props.w}
                      h={props.home ? 4 : 5}
                      color="rgba(255,255,255,.25)"
                    />
                    <TvView
                      x={0}
                      y={props.h - (props.home ? 4 : 5)}
                      w={props.w * (props.card.progress ?? 0)}
                      h={props.home ? 4 : 5}
                      color={palette.accent}
                    />
                  </>
                }
              >
                <TvView y={props.h - 4}>
                  <HomeProgress
                    width={props.w}
                    tileHeight={props.h}
                    progress={props.card.progress!}
                  />
                </TvView>
              </Show>
            </Show>
            <Show when={props.card.view?.tile_badge?.label}>
              <TvView
                x={12}
                y={12}
                w={badgeWidth()}
                h={props.library || props.home ? 30 : 36}
                rounded={6}
                color={palette.text}
              >
                <Label
                  x={10}
                  centerY={props.library || props.home ? 15 : 18}
                  size={props.library || props.home ? 18 : 20}
                  font="Onest700"
                  maxwidth={props.w - 44}
                  maxlines={1}
                  content={props.card.view?.tile_badge?.label ?? ""}
                  color="#111113"
                />
              </TvView>
            </Show>
            <Show
              when={
                props.home &&
                props.focused &&
                props.card.view?.preview?.action === "play"
              }
            >
              <TilePlay art={playArt()} />
            </Show>
          </TvView>
          <Show when={props.library || props.home}>
            <TvView
              w={props.w}
              h={props.h}
              src={cardOutline(props.w, props.h, props.focused)}
            />
          </Show>
          <Show when={!props.poster || props.focused}>
            <Label
              y={props.h + (props.library || props.home ? 14 : 16)}
              size={props.home && !props.poster ? 24 : 22}
              font="Onest600"
              maxwidth={props.w}
              maxlines={1}
              content={props.card.title}
              color={props.home && !props.focused ? palette.body : palette.text}
            />
            <Label
              y={props.h + (props.home && !props.poster ? 48 : 45)}
              size={props.library || props.home ? 20 : 18}
              maxwidth={props.w}
              maxlines={1}
              content={
                props.poster
                  ? (props.card.view?.compact_metadata_parts?.join(" · ") ?? "")
                  : (props.card.subtitle ?? "")
              }
              color={props.home && !props.focused ? "#8F8D89" : palette.muted}
            />
          </Show>
        </TvView>
      );
    }
    function keyboard(isModal = false) {
      const numeric = () =>
        isModal &&
        overlay()?.kind === "text" &&
        (overlay() as Extract<Overlay, { kind: "text" }>).numeric;
      const keys = () =>
        numeric()
          ? ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "Done"]
          : [
              ...keyboardCharacters(),
              keyboardUpper() ? "aa" : "Aa",
              "Space",
              "⌫",
              keyboardSymbols() ? "ABC" : "#+=",
              isModal ? "Done" : "Search",
              isModal ? "Cancel" : "Clear",
            ];
      return (
        <TvView
          x={numeric() ? 744 : 96}
          y={numeric() ? 540 : isModal ? 350 : 280}
        >
          <For each={keys()}>
            {(letter, index) => (
              <TvView
                x={(index() % (numeric() ? 3 : 6)) * (numeric() ? 148 : 78)}
                y={
                  Math.floor(index() / (numeric() ? 3 : 6)) *
                  (numeric() ? 88 : 78)
                }
                w={numeric() ? 136 : 68}
                h={numeric() ? 76 : 68}
                rounded={12}
                color={
                  key() === index() ? palette.text : "rgba(255,255,255,.1)"
                }
              >
                <Label
                  centerY={numeric() ? 38 : 34}
                  w={numeric() ? 136 : 68}
                  align="center"
                  size={letter.length > 1 ? 18 : numeric() ? 32 : 26}
                  font="Onest600"
                  content={letter}
                  color={key() === index() ? "#111113" : palette.text}
                />
              </TvView>
            )}
          </For>
        </TvView>
      );
    }
    const Root = defineScreen({
      input: {
        left() {
          if (dismissScreenSaver()) return;
          move(-1, 0);
        },
        right() {
          if (dismissScreenSaver()) return;
          move(1, 0);
        },
        up() {
          if (dismissScreenSaver()) return;
          move(0, -1);
        },
        down() {
          if (dismissScreenSaver()) return;
          move(0, 1);
        },
        back() {
          if (dismissScreenSaver()) return;
          void back().catch(fail);
        },
        menu() {
          if (dismissScreenSaver()) return;
          menu();
        },
        enter(event?: KeyboardEvent) {
          if (dismissScreenSaver()) return;
          // A held Enter auto-repeats; only the first keydown arms the hold
          // timer, so repeats must not reset it or the 700ms menu never fires.
          if (event?.repeat) return undefined;
          resetHeroCycle();
          if (overlay()?.kind === "sources") manualSourceSelection = true;
          const target = pressTarget(),
            pressedOverlay = overlay();
          let held = false;
          clearTimeout(holdTimer);
          if (!overlay())
            holdTimer = setTimeout(() => {
              (window as any).__holdPending = pending();
              (window as any).__holdLoading = loading();
              if (target === pressTarget() && !pending() && !loading()) {
                held = true;
                menu();
              }
            }, 700);
          return () => {
            clearTimeout(holdTimer);
            if (
              !held &&
              overlay() === pressedOverlay &&
              target === pressTarget()
            )
              void activate().catch(fail);
          };
        },
      },
      render: () => (
        <TvView
          w={1920}
          h={1080}
          color={
            ["player", "home", "detail"].includes(screen())
              ? "rgba(0,0,0,0)"
              : palette.bg
          }
        >
          <TvView
            w={sceneWidth()}
            h={1080}
            clipping={sceneWidth() < 1920}
            show={!profileEditor() && overlay()?.kind !== "text"}
          >
            <TvView w={1920} h={1080}>
              <Show when={screen() === "home" && zone() !== "rows"}>
                <BillboardBackdrop art={billboard} />
              </Show>
              <Show when={screen() === "home" && zone() === "rows"}>
                <BrowseBackdrop card={hero()} />
              </Show>
              <Show when={screen() === "detail"}>
                <Backdrop
                  src={hero()?.landscape}
                  dim={
                    screen() === "detail" &&
                    ["episodes", "seasons", "recommendations"].includes(zone())
                  }
                />
              </Show>
            </TvView>
            <Show
              when={
                ![
                  "welcome",
                  "pairing",
                  "signed-in",
                  "profiles",
                  "player",
                  "settings",
                ].includes(screen()) &&
                !(screen() === "home" && zone() === "rows") &&
                screen() !== "detail"
              }
            >
              <TvView
                x={96}
                y={44}
                w={44}
                h={44}
                rounded={12}
                color={palette.accent}
              >
                <Label
                  w={44}
                  centerY={22}
                  align="center"
                  size={28}
                  font="Bricolage800"
                  content="V"
                  color="#15130F"
                />
              </TvView>
              <Label
                x={152}
                centerY={66}
                font="Bricolage800"
                size={32}
                letterspacing={-0.96}
                content="VIPTV"
              />
              <For each={navs()}>
                {(nav, index) => (
                  <TvView
                    x={navLayout()[index()].x}
                    y={38}
                    w={navLayout()[index()].w}
                    h={56}
                    rounded={28}
                    color={
                      zone() === "nav" && column() === index()
                        ? palette.text
                        : "rgba(0,0,0,0)"
                    }
                  >
                    <Show when={nav.id === "search"}>
                      <TvView
                        x={13}
                        y={13}
                        w={30}
                        h={30}
                        src={icon(
                          "search",
                          zone() === "nav" && column() === index(),
                          2.2,
                          zone() === "nav" && column() === index()
                            ? "#111113"
                            : palette.body,
                        )}
                      />
                    </Show>
                    <Show when={nav.id === "profiles"}>
                      <TvView
                        x={-2}
                        y={-2}
                        w={60}
                        h={60}
                        rounded={30}
                        color={
                          zone() === "nav" && column() === index()
                            ? palette.text
                            : "rgba(255,255,255,.35)"
                        }
                      />
                      <TvView
                        w={56}
                        h={56}
                        rounded={28}
                        src={avatar(
                          management()?.profiles.find(
                            (p) => p.id === api.profile,
                          )?.avatar_id,
                        )}
                        fit="cover"
                      />
                    </Show>
                    <Show when={nav.id !== "search" && nav.id !== "profiles"}>
                      <Label
                        x={18}
                        centerY={28}
                        size={26}
                        font={screen() === nav.id ? "Onest700" : "Onest500"}
                        content={nav.label}
                        color={
                          zone() === "nav" && column() === index()
                            ? "#111113"
                            : screen() === nav.id
                              ? palette.text
                              : palette.body
                        }
                      />
                      <TvView
                        show={screen() === nav.id}
                        x={18}
                        y={49}
                        w={navLayout()[index()].w - 36}
                        h={3}
                        rounded={2}
                        color={palette.text}
                      />
                    </Show>
                  </TvView>
                )}
              </For>
            </Show>
            <Show when={screen() === "welcome"}>
              <EntryScreen
                loading={loading()}
                focused={!loading() && !error()}
              />
            </Show>
            <Show when={screen() === "pairing"}>
              <PairingScreen
                pairing={pairing()}
                qr={qr()}
                deadline={pairingDeadline()}
                focused={pairingFocused() && !loading() && !error()}
              />
            </Show>
            <Show when={screen() === "signed-in" && signedIn()}>
              {(value) => (
                <SignedIn bootstrap={value()} onComplete={finishSignIn} />
              )}
            </Show>
            <Show when={screen() === "profiles"}>
              <ProfilesScreen
                profiles={management()?.profiles ?? []}
                create={available(management()?.capabilities.create)}
                manage={canManageProfiles()}
                index={column()}
                zone={zone()}
              />
            </Show>
            <Show when={screen() === "home"}>
              <Show when={home()?.complete && !hero()}>
                <Label
                  x={96}
                  y={300}
                  size={44}
                  font="Onest700"
                  content="Nothing here yet"
                />
                <Label
                  x={96}
                  y={375}
                  size={28}
                  color={palette.muted}
                  maxwidth={1000}
                  content="Add an add-on in Settings to find something to watch."
                />
                <Button
                  x={96}
                  y={480}
                  w={320}
                  label="Open Settings"
                  focused={zone() === "hero"}
                />
              </Show>
              <Show when={zone() === "rows" && hero()}>
                {(card) => <BrowsePreview card={card()} />}
              </Show>
              <Show when={zone() !== "rows" && hero()}>
                {(card) => (
                  <TvView x={96} y={300}>
                    <Show
                      when={card().logo}
                      fallback={
                        <Label
                          y={0}
                          size={zone() === "rows" ? 44 : 64}
                          font="Onest700"
                          maxwidth={800}
                          maxlines={2}
                          content={card().title}
                        />
                      }
                    >
                      <Logo
                        title={card().title}
                        size={zone() === "rows" ? 44 : 64}
                        src={card().logo!}
                        h={zone() === "rows" ? 120 : 170}
                      />
                    </Show>
                    <Metadata card={card()} y={zone() === "rows" ? 144 : 194} />
                    <Label
                      y={zone() === "rows" ? 196 : 244}
                      size={26}
                      lineheight={1.45}
                      maxwidth={780}
                      maxlines={2}
                      color={palette.body}
                      content={card().description ?? ""}
                    />
                    <Show when={zone() !== "rows"}>
                      <Button
                        x={0}
                        y={348}
                        w={220}
                        icon="play"
                        iconSize={24}
                        shadow
                        label="Play"
                        focused={zone() === "hero" && heroAction() === 0}
                      />
                      <BillboardButton
                        art={billboard}
                        pageX={336}
                        pageY={648}
                        x={240}
                        y={348}
                        icon={isSaved(card()) ? "check" : "plus"}
                        focused={zone() === "hero" && heroAction() === 1}
                      />
                      <BillboardButton
                        art={billboard}
                        pageX={428}
                        pageY={648}
                        x={332}
                        y={348}
                        icon="info"
                        focused={zone() === "hero" && heroAction() === 2}
                      />
                      <For each={(home()?.featured ?? []).slice(0, 5)}>
                        {(_, i) => (
                          <TvView
                            x={i() * 24 + (i() > heroSlide() ? 32 : 0)}
                            y={460}
                          >
                            <Show
                              when={i() === heroSlide()}
                              fallback={
                                <TvView
                                  w={16}
                                  h={4}
                                  rounded={2}
                                  color="rgba(255,255,255,.3)"
                                />
                              }
                            >
                              <HeroProgress
                                started={heroCycleStart()}
                                running={heroActive()}
                              />
                            </Show>
                          </TvView>
                        )}
                      </For>
                    </Show>
                  </TvView>
                )}
              </Show>
              <TvView
                x={96}
                y={zone() === "rows" ? 514 : 826}
                transition={{
                  y: {
                    duration: 450,
                    timingFunction: "cubic-bezier(.2,0,0,1)",
                  },
                }}
                w={1824}
                h={650}
                clipping={true}
              >
                <For
                  each={(home()?.rows ?? []).slice(
                    zone() === "rows" ? row() : 0,
                    (zone() === "rows" ? row() : 0) + 2,
                  )}
                >
                  {(shelf, index) => (
                    <TvView y={index() * 384}>
                      <Label
                        y={-2}
                        size={30}
                        font="Onest600"
                        letterspacing={-0.3}
                        content={shelf.title}
                      />
                      <Show when={shelf.state === "Ready"}>
                        <KeyedFor
                          each={shelf.cards.slice(
                            zone() === "rows" && index() === 0
                              ? Math.max(0, column() - 3)
                              : 0,
                            (zone() === "rows" && index() === 0
                              ? Math.max(0, column() - 3)
                              : 0) +
                              (shelf.view?.card_shape === "poster" ? 8 : 6),
                          )}
                          keyOf={cardKey}
                        >
                          {(card, i) => (
                            <Tile
                              home
                              card={card()}
                              x={
                                i() *
                                (shelf.view?.card_shape === "poster"
                                  ? 248
                                  : 404)
                              }
                              y={50}
                              w={
                                shelf.view?.card_shape === "poster" ? 232 : 384
                              }
                              h={
                                shelf.view?.card_shape === "poster" ? 348 : 216
                              }
                              poster={shelf.view?.card_shape === "poster"}
                              focused={
                                zone() === "rows" &&
                                index() === 0 &&
                                i() + Math.max(0, column() - 3) === column()
                              }
                            />
                          )}
                        </KeyedFor>
                      </Show>
                      <Show when={shelf.state !== "Ready"}>
                        <Show when={shelf.state === "Failed"}>
                          <Button
                            x={0}
                            y={120}
                            w={260}
                            label="Try again"
                            focused={zone() === "rows" && index() === 0}
                          />
                        </Show>
                        <Label
                          y={70}
                          size={26}
                          color={palette.muted}
                          content={
                            shelf.state === "Pending"
                              ? ""
                              : (shelf.message ??
                                (shelf.state === "Empty"
                                  ? "Nothing here yet."
                                  : "Couldn’t load this row."))
                          }
                        />
                        <For
                          each={
                            shelf.state === "Pending" ? [0, 1, 2, 3, 4] : []
                          }
                        >
                          {(i) => (
                            <TvView
                              x={i * 404}
                              y={50}
                              w={384}
                              h={216}
                              rounded={10}
                              color={palette.surface}
                            />
                          )}
                        </For>
                      </Show>
                    </TvView>
                  )}
                </For>
              </TvView>
            </Show>
            <Show when={screen() === "detail"}>
              <Show when={detail()}>
                {(value) => (
                  <>
                    <Show
                      when={
                        ["episodes", "seasons", "recommendations"].includes(
                          zone(),
                        ) && value().item.logo
                      }
                    >
                      <TvView x={96} y={54}>
                        <Logo
                          src={value().item.logo!}
                          h={68}
                          maxWidth={220}
                          title={value().item.title}
                        />
                      </TvView>
                    </Show>
                    <TvView
                      show={
                        !["episodes", "seasons", "recommendations"].includes(
                          zone(),
                        )
                      }
                      x={96}
                      y={
                        ["episodes", "seasons", "recommendations"].includes(
                          zone(),
                        )
                          ? -480
                          : 0
                      }
                    >
                      <TvView y={value().episodes.length ? 250 : 220}>
                        <Show
                          when={value().item.logo}
                          fallback={
                            <Label
                              size={56}
                              font="Onest700"
                              maxwidth={850}
                              content={value().item.title}
                            />
                          }
                        >
                          <Logo
                            title={value().item.title}
                            size={56}
                            src={value().item.logo!}
                            h={190}
                            maxWidth={value().episodes.length ? 460 : 800}
                          />
                        </Show>
                      </TvView>
                      <Metadata
                        card={value().item}
                        y={value().episodes.length ? 410 : 432}
                        detail
                      />
                      <Label
                        y={value().episodes.length ? 460 : 482}
                        size={26}
                        lineheight={1.45}
                        maxwidth={800}
                        maxlines={3}
                        color={palette.body}
                        content={value().item.description ?? ""}
                      />
                      <Button
                        x={0}
                        y={value().episodes.length ? 648 : 668}
                        w={
                          value().episodes.length || detailAction()?.resume
                            ? 420
                            : 260
                        }
                        icon="play"
                        label={detailAction()?.label ?? "Play"}
                        focused={zone() === "hero" && heroAction() === 0}
                      />
                      <Show when={detailAction()?.resume}>
                        <Label
                          x={288}
                          y={673}
                          size={24}
                          font="Onest600"
                          color={heroAction() === 0 ? "#555553" : palette.muted}
                          content={detailAction()?.remaining_label ?? ""}
                        />
                        <TvView
                          x={28}
                          y={704}
                          w={364}
                          h={4}
                          rounded={2}
                          color="rgba(17,17,19,.18)"
                        />
                        <TvView
                          x={28}
                          y={704}
                          w={364 * (detailAction()?.progress ?? 0)}
                          h={4}
                          rounded={2}
                          color={heroAction() === 0 ? "#111113" : palette.text}
                        />
                      </Show>
                      <Button
                        x={
                          value().episodes.length || detailAction()?.resume
                            ? 440
                            : 280
                        }
                        y={value().episodes.length ? 648 : 668}
                        icon={isSaved(value().item) ? "check" : "plus"}
                        round
                        focused={zone() === "hero" && heroAction() === 1}
                      />
                      <Button
                        x={
                          value().episodes.length || detailAction()?.resume
                            ? 532
                            : 372
                        }
                        y={value().episodes.length ? 648 : 668}
                        icon="episodes"
                        round
                        focused={zone() === "hero" && heroAction() === 2}
                      />
                      <Button
                        x={0}
                        y={592}
                        w={386}
                        h={48}
                        label="Choose a source"
                        focused={zone() === "hero" && heroAction() === 3}
                      />
                    </TvView>
                    <TvView
                      x={96}
                      y={
                        ["episodes", "seasons", "recommendations"].includes(
                          zone(),
                        )
                          ? value().seasons.length
                            ? 154
                            : 184
                          : value().seasons.length
                            ? 816
                            : 836
                      }
                      w={1824}
                      h={850}
                      clipping={true}
                    >
                      <Show when={!value().seasons.length}>
                        <Label
                          size={30}
                          font="Onest600"
                          content={
                            value().episodes.length
                              ? "Episodes"
                              : "More Like This"
                          }
                        />
                      </Show>
                      <For
                        each={value().seasons.slice(
                          Math.max(
                            0,
                            (zone() === "seasons" ? column() : seasonIndex()) -
                              2,
                          ),
                          Math.max(
                            0,
                            (zone() === "seasons" ? column() : seasonIndex()) -
                              2,
                          ) + 8,
                        )}
                      >
                        {(season, i) => (
                          <Button
                            x={i() * 174}
                            y={0}
                            w={154}
                            h={52}
                            pill
                            label={
                              season.season == null
                                ? "Episodes"
                                : `Season ${season.season}`
                            }
                            focused={
                              zone() === "seasons" &&
                              column() === i() + Math.max(0, column() - 2)
                            }
                          />
                        )}
                      </For>
                      <KeyedFor
                        each={(value().episodes.length
                          ? value().episodes
                          : value().recommendations
                        ).slice(
                          zone() === "episodes"
                            ? Math.floor(
                                column() / (value().episodes.length ? 4 : 7),
                              ) * (value().episodes.length ? 4 : 7)
                            : 0,
                          (zone() === "episodes"
                            ? Math.floor(
                                column() / (value().episodes.length ? 4 : 7),
                              ) * (value().episodes.length ? 4 : 7)
                            : 0) + 8,
                        )}
                        keyOf={cardKey}
                      >
                        {(card, i) => (
                          <Tile
                            card={card()}
                            x={i() * (value().episodes.length ? 472 : 248)}
                            y={
                              value().seasons.length
                                ? zone() === "hero"
                                  ? 72
                                  : 82
                                : 52
                            }
                            w={value().episodes.length ? 448 : 232}
                            h={value().episodes.length ? 252 : 348}
                            poster={!value().episodes.length}
                            focused={
                              zone() === "episodes" &&
                              i() ===
                                column() % (value().episodes.length ? 4 : 7)
                            }
                          />
                        )}
                      </KeyedFor>
                    </TvView>
                    <Show
                      when={
                        value().episodes.length &&
                        value().recommendations.length &&
                        ["episodes", "seasons", "recommendations"].includes(
                          zone(),
                        )
                      }
                    >
                      <TvView x={96} y={676} w={1824} h={404} clipping>
                        <Label
                          size={30}
                          font="Onest600"
                          content="More Like This"
                        />
                        <KeyedFor
                          each={value().recommendations.slice(
                            zone() === "recommendations"
                              ? Math.floor(column() / 7) * 7
                              : 0,
                            (zone() === "recommendations"
                              ? Math.floor(column() / 7) * 7
                              : 0) + 8,
                          )}
                          keyOf={cardKey}
                        >
                          {(card, i) => (
                            <Tile
                              home
                              card={card()}
                              x={i() * 248}
                              y={52}
                              w={232}
                              h={348}
                              poster
                              focused={
                                zone() === "recommendations" &&
                                column() % 7 === i()
                              }
                            />
                          )}
                        </KeyedFor>
                      </TvView>
                    </Show>
                  </>
                )}
              </Show>
            </Show>
            <Show
              when={["movie", "series", "library", "search"].includes(screen())}
            >
              <Show when={screen() === "library"}>
                <LibraryToolbar
                  types={libraryTypes()}
                  sort={librarySort()}
                  filters={libraryFilters().length > 0}
                  query={library()?.query}
                  focused={zone() === "library-controls"}
                  index={column()}
                />
              </Show>
              <Show when={screen() === "movie" || screen() === "series"}>
                <For
                  each={[
                    {
                      id: "catalog",
                      label: catalog()?.name ?? "Choose a catalog",
                    },
                    ...((catalog()?.controls.length ?? 0) > 0
                      ? [{ id: "filters", label: "Filters" }]
                      : []),
                  ]}
                >
                  {(control, index) => (
                    <TvView
                      x={index() === 0 ? 96 : 560 + (index() - 1) * 220}
                      y={140}
                      w={index() === 0 ? 360 : 200}
                      h={64}
                      rounded={32}
                      color={
                        zone() === "filters" && column() === index()
                          ? palette.text
                          : "rgba(255,255,255,.12)"
                      }
                    >
                      <Label
                        x={22}
                        centerY={28}
                        size={23}
                        maxwidth={236}
                        maxlines={1}
                        content={control.label}
                        color={
                          zone() === "filters" && column() === index()
                            ? "#111113"
                            : palette.text
                        }
                      />
                    </TvView>
                  )}
                </For>
              </Show>
              <Show when={screen() === "search"}>
                <SearchInput
                  value={search()}
                  index={key()}
                  focused={zone() === "keyboard"}
                />
                <Show when={searchCapabilities().media}>
                  <Label
                    x={700}
                    y={140}
                    size={30}
                    font="Onest600"
                    letterspacing={-0.3}
                    content="Top results"
                  />
                </Show>
                <Show when={searchNeedsRetry()}>
                  <Label
                    x={page().cards.length ? 880 : 700}
                    y={page().cards.length ? 146 : 220}
                    size={page().cards.length ? 20 : 28}
                    maxwidth={page().cards.length ? 700 : 1100}
                    maxlines={page().cards.length ? 1 : 2}
                    content={
                      searchError() ||
                      (page().cards.length
                        ? "Partial results"
                        : "Some search results are unavailable.")
                    }
                  />
                  <Button
                    x={page().cards.length ? 1624 : 700}
                    y={page().cards.length ? 128 : 320}
                    w={page().cards.length ? 200 : 260}
                    h={page().cards.length ? 56 : 72}
                    pill={page().cards.length > 0}
                    label="Try again"
                    focused={zone() === "search-retry"}
                  />
                </Show>
              </Show>
              <Show when={screen() !== "search" || searchCapabilities().media}>
                <TvView
                  x={screen() === "search" ? 700 : 96}
                  y={
                    screen() === "search"
                      ? 196
                      : screen() === "library"
                        ? 236
                        : 244
                  }
                  w={screen() === "search" ? 1124 : 1824}
                  h={
                    screen() === "search" && searchCapabilities().channels
                      ? 388
                      : 800
                  }
                  clipping={true}
                >
                  <Show
                    when={
                      screen() === "search" &&
                      searchMediaPending() &&
                      !page().cards.length
                    }
                  >
                    <For each={[0, 1, 2, 3, 4]}>
                      {(i) => (
                        <TvView
                          x={i * 228}
                          w={212}
                          h={318}
                          rounded={10}
                          color="rgba(255,255,255,.06)"
                        />
                      )}
                    </For>
                  </Show>
                  <KeyedFor
                    each={page().cards.slice(
                      gridStart(),
                      gridStart() + gridCount(),
                    )}
                    keyOf={cardKey}
                  >
                    {(card, i) => (
                      <Tile
                        card={card()}
                        x={
                          (i() % gridColumns()) *
                          (screen() === "search" ? 228 : 248)
                        }
                        y={
                          Math.floor(i() / gridColumns()) *
                          (screen() === "search"
                            ? 388
                            : screen() === "library"
                              ? 440
                              : 384)
                        }
                        w={screen() === "search" ? 212 : 232}
                        h={screen() === "search" ? 318 : 348}
                        focused={
                          zone() === "content" && i() + gridStart() === column()
                        }
                        poster
                        library={
                          screen() === "library" || screen() === "search"
                        }
                      />
                    )}
                  </KeyedFor>
                  <Show
                    when={
                      !loading() &&
                      !page().cards.length &&
                      !(
                        screen() === "search" &&
                        (searchNeedsRetry() || searchMediaPending())
                      )
                    }
                  >
                    <Label
                      y={100}
                      size={32}
                      font="Onest600"
                      content={
                        screen() === "search" && !search()
                          ? "Find something to watch"
                          : screen() === "library"
                            ? "Your list is empty"
                            : "Nothing matches"
                      }
                    />
                    <Label
                      y={160}
                      size={26}
                      color={palette.muted}
                      content={
                        screen() === "library"
                          ? "Add a title to find it here."
                          : "Try a different search or filter."
                      }
                    />
                  </Show>
                </TvView>
              </Show>
              <Show
                when={
                  screen() === "search" &&
                  searchCapabilities().channels &&
                  search()
                }
              >
                <SearchChannels
                  channels={searchChannels()}
                  hasPrevious={!!edgeRequest(searchChannelPages(), "previous")}
                  index={
                    zone() === "search-channels" ? column() : searchChannelFocus
                  }
                  focused={zone() === "search-channels"}
                  y={searchCapabilities().media ? 584 : 140}
                  pending={searchChannelsPending() || searchChannelPaging()}
                  error={searchChannelError()}
                  retryFocused={zone() === "search-channel-retry"}
                />
              </Show>
            </Show>
            <Show when={screen() === "live"}>
              <TvView x={96} y={130} w={64} h={30} rounded={5} color="#FF5A4E">
                <Label
                  w={64}
                  centerY={15}
                  align="center"
                  size={20}
                  font="Onest700"
                  content="LIVE"
                />
              </TvView>
              <Label
                x={176}
                y={130}
                size={24}
                color={palette.muted}
                maxwidth={920}
                maxlines={1}
                content={channels()[liveChannelIndex()]?.card.title ?? ""}
              />
              <Label
                x={96}
                y={174}
                size={56}
                font="Onest700"
                maxwidth={1000}
                maxlines={1}
                content={
                  currentProgram()?.title ??
                  channels()[liveChannelIndex()]?.card.title ??
                  "Live TV"
                }
              />
              <Show when={currentProgram()}>
                {(p) => (
                  <>
                    <Label
                      x={96}
                      y={250}
                      size={26}
                      content={`${guideTime(p().start_millis)} – ${guideTime(p().end_millis)}`}
                    />
                    <TvView
                      x={96}
                      y={292}
                      w={360}
                      h={4}
                      color="rgba(255,255,255,.2)"
                    />
                    <TvView
                      x={96}
                      y={292}
                      w={
                        360 *
                        Math.max(
                          0,
                          Math.min(
                            1,
                            ((currentGuide()?.now_millis ?? p().start_millis) -
                              p().start_millis) /
                              (p().end_millis - p().start_millis),
                          ),
                        )
                      }
                      h={4}
                      color={palette.text}
                    />
                    <Label
                      x={96}
                      y={316}
                      size={28}
                      maxwidth={1000}
                      maxlines={3}
                      content={p().description ?? ""}
                    />
                  </>
                )}
              </Show>
              <Show when={channels()[liveChannelIndex()]?.card.landscape}>
                <TvView
                  x={1184}
                  y={120}
                  w={640}
                  h={360}
                  rounded={12}
                  src={channels()[liveChannelIndex()]?.card.landscape}
                  fit="cover"
                />
              </Show>
              <For
                each={[{ id: "all", label: "All" }, ...groups()].slice(
                  liveGroupStart(),
                  liveGroupStart() + 9,
                )}
              >
                {(group, i) => (
                  <TvView
                    x={96 + i() * 160}
                    y={512}
                    w={144}
                    h={52}
                    rounded={26}
                    color={
                      zone() === "live-groups" &&
                      column() === i() + liveGroupStart()
                        ? palette.text
                        : liveGroup() === group.id ||
                            (!liveGroup() && group.id === "all")
                          ? "#34343A"
                          : "rgba(0,0,0,0)"
                    }
                  >
                    <Label
                      w={144}
                      align="center"
                      centerY={26}
                      size={22}
                      font="Onest600"
                      maxlines={1}
                      content={group.label}
                      color={
                        zone() === "live-groups" &&
                        column() === i() + liveGroupStart()
                          ? "#111113"
                          : palette.muted
                      }
                    />
                  </TvView>
                )}
              </For>
              <For each={[0, 1, 2, 3]}>
                {(i) => (
                  <Label
                    x={420 + i * 350}
                    y={592}
                    size={22}
                    color={palette.muted}
                    content={
                      currentGuide()
                        ? guideTime(guideStart() + i * 1800000)
                        : ""
                    }
                  />
                )}
              </For>
              <TvView x={96} y={636} w={1728} h={408} clipping={true}>
                <For
                  each={channels().slice(
                    Math.max(0, guideRowStart()),
                    guideRowStart() + 5,
                  )}
                >
                  {(channel, i) => (
                    <TvView
                      y={
                        (i() + Math.max(0, guideRowStart()) - guideRowStart()) *
                        80
                      }
                    >
                      <TvView
                        w={300}
                        h={72}
                        rounded={12}
                        color={palette.surface}
                      >
                        <Label
                          x={24}
                          centerY={36}
                          size={26}
                          font="Onest700"
                          maxwidth={250}
                          maxlines={1}
                          content={
                            (liveFavorites()?.has(channel.id) ? "★  " : "") +
                            channel.card.title
                          }
                        />
                      </TvView>
                      <TvView x={328} w={1400} h={72} clipping={true}>
                        <Show
                          when={programs()[channel.id]?.length}
                          fallback={
                            <TvView
                              w={1400}
                              h={72}
                              rounded={12}
                              color={
                                i() + Math.max(0, guideRowStart()) ===
                                  column() && zone() === "content"
                                  ? palette.text
                                  : palette.surface
                              }
                            >
                              <Label
                                x={20}
                                centerY={36}
                                size={24}
                                content="Programme information unavailable"
                                color={
                                  i() + Math.max(0, guideRowStart()) ===
                                    column() && zone() === "content"
                                    ? "#111113"
                                    : palette.muted
                                }
                              />
                            </TvView>
                          }
                        >
                          <For
                            each={(programs()[channel.id] ?? [])
                              .filter(
                                (p) =>
                                  p.end_millis > guideStart() &&
                                  p.start_millis < guideStart() + 7200000,
                              )
                              .slice(0, 12)}
                          >
                            {(program) => (
                              <TvView
                                x={Math.max(
                                  0,
                                  ((program.start_millis - guideStart()) /
                                    7200000) *
                                    1400,
                                )}
                                w={Math.max(
                                  12,
                                  ((Math.min(
                                    guideStart() + 7200000,
                                    program.end_millis,
                                  ) -
                                    Math.max(
                                      guideStart(),
                                      program.start_millis,
                                    )) /
                                    7200000) *
                                    1400 -
                                    8,
                                )}
                                h={72}
                                rounded={12}
                                color={
                                  i() + Math.max(0, guideRowStart()) ===
                                    column() &&
                                  program.id === currentProgram()?.id &&
                                  zone() === "content"
                                    ? palette.text
                                    : "#212124"
                                }
                              >
                                <Label
                                  x={20}
                                  centerY={36}
                                  size={24}
                                  maxwidth={Math.max(
                                    0,
                                    ((Math.min(
                                      guideStart() + 7200000,
                                      program.end_millis,
                                    ) -
                                      Math.max(
                                        guideStart(),
                                        program.start_millis,
                                      )) /
                                      7200000) *
                                      1400 -
                                      48,
                                  )}
                                  maxlines={1}
                                  content={program.title}
                                  color={
                                    i() + Math.max(0, guideRowStart()) ===
                                      column() &&
                                    program.id === currentProgram()?.id &&
                                    zone() === "content"
                                      ? "#111113"
                                      : palette.text
                                  }
                                />
                              </TvView>
                            )}
                          </For>
                        </Show>
                      </TvView>
                    </TvView>
                  )}
                </For>
                <Show when={currentGuide()}>
                  <TvView
                    x={
                      328 +
                      Math.max(
                        0,
                        Math.min(
                          1400,
                          (((currentGuide()?.now_millis ?? guideStart()) -
                            guideStart()) /
                            7200000) *
                            1400,
                        ),
                      )
                    }
                    w={2}
                    h={400}
                    color="#FF5A4E"
                  />
                </Show>
              </TvView>
              <Show when={!loading() && !channels().length}>
                <Label
                  x={96}
                  y={640}
                  size={28}
                  content="No live channels. Configure a source in Settings."
                />
              </Show>
            </Show>
            <Show when={screen() === "settings"}>
              <TvView w={560} h={1080} color={palette.surface} />
              <Label
                x={96}
                y={96}
                size={44}
                font="Onest700"
                content="Settings"
              />
              <For each={settingsTabs}>
                {(tab, i) => (
                  <TvView
                    x={72}
                    y={196 + i() * 80}
                    w={440}
                    h={72}
                    rounded={12}
                    color={
                      settingsTab() === i() && zone() === "settings-nav"
                        ? palette.text
                        : settingsTab() === i()
                          ? "rgba(255,255,255,.14)"
                          : "rgba(0,0,0,0)"
                    }
                  >
                    <TvView
                      x={24}
                      centerY={36}
                      w={28}
                      h={28}
                      src={navIcon(
                        tab,
                        settingsTab() === i() && zone() === "settings-nav",
                        settingsTab() === i(),
                      )}
                    />
                    <Label
                      x={70}
                      centerY={38}
                      size={26}
                      font={
                        settingsTab() === i() && zone() !== "settings-nav"
                          ? "Onest700"
                          : "Onest500"
                      }
                      content={tab}
                      color={
                        settingsTab() === i() && zone() === "settings-nav"
                          ? "#111113"
                          : settingsTab() === i()
                            ? palette.text
                            : palette.muted
                      }
                    />
                  </TvView>
                )}
              </For>
              <Label
                x={640}
                y={96}
                size={40}
                font="Onest700"
                content={settingsTabs[settingsTab()]}
              />
              <For
                each={settingsItems().slice(
                  zone() === "settings-content" ? Math.max(0, column() - 5) : 0,
                  (zone() === "settings-content"
                    ? Math.max(0, column() - 5)
                    : 0) + 7,
                )}
              >
                {(item, i) => (
                  <TvView
                    x={640}
                    y={220 + i() * 108}
                    w={1184}
                    h={96}
                    rounded={12}
                    color={
                      zone() === "settings-content" &&
                      column() === i() + Math.max(0, column() - 5)
                        ? palette.text
                        : palette.surface
                    }
                  >
                    <Label
                      x={28}
                      centerY={item.description ? 32 : 48}
                      size={26}
                      font="Onest600"
                      maxwidth={730}
                      content={item.label}
                      color={
                        zone() === "settings-content" &&
                        column() === i() + Math.max(0, column() - 5)
                          ? "#111113"
                          : palette.text
                      }
                    />
                    <Label
                      x={28}
                      y={57}
                      size={20}
                      maxwidth={900}
                      content={item.description ?? ""}
                      color={
                        zone() === "settings-content" &&
                        column() === i() + Math.max(0, column() - 5)
                          ? "#4A4945"
                          : palette.muted
                      }
                    />
                    <Show when={item.toggle !== undefined}>
                      <TvView
                        x={1088}
                        centerY={48}
                        w={68}
                        h={38}
                        rounded={19}
                        color={
                          item.toggle ? palette.accent : "rgba(255,255,255,.18)"
                        }
                      >
                        <TvView
                          x={item.toggle ? 34 : 4}
                          y={4}
                          w={30}
                          h={30}
                          rounded={15}
                          color={item.toggle ? "#15130F" : "#B6B4AF"}
                        />
                      </TvView>
                    </Show>
                    <Show when={item.swatches}>
                      {(colors: () => string[]) => (
                        <For each={colors()}>
                          {(swatch, index) => (
                            <TvView
                              x={926 + index() * 62}
                              centerY={48}
                              w={44}
                              h={44}
                              rounded={22}
                              color={swatch}
                            >
                              <Show
                                when={
                                  swatch === item.value &&
                                  zone() === "settings-content" &&
                                  column() === i() + Math.max(0, column() - 5)
                                }
                              >
                                <TvView
                                  x={-6}
                                  y={-6}
                                  w={56}
                                  h={56}
                                  src={outline(56, 56, 28, 3, "#F4F2EE")}
                                />
                                <TvView
                                  x={-3}
                                  y={-3}
                                  w={50}
                                  h={50}
                                  src={outline(50, 50, 25, 3, "#0B0B0C")}
                                />
                              </Show>
                            </TvView>
                          )}
                        </For>
                      )}
                    </Show>
                    <Show when={item.toggle === undefined && !item.swatches}>
                      <Label
                        x={760}
                        centerY={48}
                        w={item.chevron ? 360 : 390}
                        align="right"
                        size={24}
                        maxlines={1}
                        content={item.value ?? (item.chevron ? "" : "›")}
                        color={
                          zone() === "settings-content" &&
                          column() === i() + Math.max(0, column() - 5)
                            ? "#111113"
                            : palette.muted
                        }
                      />
                      <Show when={item.chevron}>
                        <TvView
                          x={1128}
                          centerY={48}
                          w={24}
                          h={24}
                          src={icon(
                            "chevron",
                            zone() === "settings-content" &&
                              column() === i() + Math.max(0, column() - 5),
                            2.2,
                            zone() === "settings-content" &&
                              column() === i() + Math.max(0, column() - 5)
                              ? "#4A4945"
                              : "#B6B4AF",
                          )}
                        />
                      </Show>
                    </Show>
                  </TvView>
                )}
              </For>
            </Show>
            <Show
              when={
                screen() === "player" &&
                !overlay() &&
                (showControls() ||
                  loading() ||
                  snapshot()?.state === "ended" ||
                  error())
              }
            >
              <TvView w={1920} h={1080} color="rgba(0,0,0,.35)" />
              <Label
                x={96}
                y={64}
                size={30}
                font="Onest700"
                content={activeAction()?.card.title ?? ""}
              />
              <Label
                x={96}
                y={110}
                size={24}
                content={activeAction()?.card.subtitle ?? ""}
                color={palette.body}
              />
              <Show when={playerActions().seek}>
                <TvView
                  x={96}
                  y={936}
                  w={1728}
                  h={8}
                  rounded={4}
                  color="rgba(255,255,255,.3)"
                />
                <TvView
                  x={96}
                  y={936}
                  w={
                    1728 *
                    Math.min(
                      1,
                      (seek() ?? snapshot()?.time.positionSeconds ?? 0) /
                        (snapshot()?.time.durationSeconds || 1),
                    )
                  }
                  h={8}
                  rounded={4}
                  color={palette.accent}
                />
                <Label
                  x={96}
                  y={970}
                  size={22}
                  content={clock(
                    seek() ?? snapshot()?.time.positionSeconds ?? 0,
                  )}
                />
                <Label
                  x={1660}
                  y={970}
                  w={164}
                  align="right"
                  size={22}
                  content={clock(snapshot()?.time.durationSeconds ?? 0)}
                />
              </Show>
              <For each={playerButtons().slice(1)}>
                {(button, index) => (
                  <Button
                    x={button.id === "next" ? 1608 : 96 + index() * 240}
                    y={846}
                    w={button.id === "next" ? 216 : 228}
                    h={56}
                    pill
                    label={button.label}
                    focused={choice() === index() + 1}
                  />
                )}
              </For>
            </Show>
            <Show
              when={
                loading() && !["player", "welcome", "search"].includes(screen())
              }
            >
              <For each={[0, 1, 2]}>
                {(i) => (
                  <TvView
                    x={96 + i * 404}
                    y={screen() === "welcome" ? 560 : 470}
                    w={384}
                    h={216}
                    rounded={10}
                    color={palette.surface}
                  />
                )}
              </For>
            </Show>
          </TvView>
          <Show when={overlay()}>
            {(modal) => (
              <>
                <TvView w={sceneWidth()} h={1080} color="rgba(0,0,0,.6)" />
                <Show when={modal().kind === "calibration"}>
                  {/* No reference board exists for the calibration sheet; the
                      frame marks the working safe area in the accent colour
                      while the stage transform previews it live. */}
                  <TvView
                    x={Math.round((calibrationValue() * 1920) / 100)}
                    y={Math.round((calibrationValue() * 1080) / 100)}
                    w={Math.round(1920 * (1 - (2 * calibrationValue()) / 100))}
                    h={Math.round(1080 * (1 - (2 * calibrationValue()) / 100))}
                    src={outline(
                      Math.max(
                        8,
                        Math.round(1920 * (1 - (2 * calibrationValue()) / 100)),
                      ),
                      Math.max(
                        8,
                        Math.round(1080 * (1 - (2 * calibrationValue()) / 100)),
                      ),
                      4,
                      3,
                      palette.accent,
                    )}
                  />
                  <TvView
                    x={610}
                    y={430}
                    w={700}
                    h={220}
                    rounded={14}
                    color={palette.surface}
                  >
                    <Label
                      x={40}
                      y={36}
                      size={40}
                      font="Onest700"
                      content={modal().title}
                    />
                    <Label
                      x={40}
                      y={100}
                      size={64}
                      font="Onest700"
                      color={palette.accent}
                      content={`${calibrationValue()}%`}
                    />
                    <Label
                      x={40}
                      y={180}
                      size={20}
                      color={palette.muted}
                      content="Left and right adjust. OK saves; Back restores."
                    />
                  </TvView>
                </Show>
                <Show when={modal().kind === "sources"}>
                  <TvView
                    x={overlayEntered() && !overlayClosing() ? 960 : 1920}
                    w={960}
                    h={1080}
                    color={palette.surface}
                    transition={{
                      x: {
                        duration: overlayClosing() ? 200 : 300,
                        timingFunction: overlayClosing()
                          ? "cubic-bezier(.3,0,1,1)"
                          : "cubic-bezier(0,0,0,1)",
                      },
                    }}
                  >
                    <Label
                      x={64}
                      y={72}
                      size={44}
                      font="Onest700"
                      content="Choose a source"
                    />
                    <Label
                      x={64}
                      y={138}
                      size={24}
                      color={palette.muted}
                      maxwidth={800}
                      maxlines={1}
                      content={`${pickerCard()?.title ?? ""} · ${sources().length} sources`}
                    />
                    <For
                      each={[
                        {
                          label: "All",
                          count: sourcePage()?.total ?? sources().length,
                        },
                        ...(sourcePage()?.quality_filters ?? []),
                      ]}
                    >
                      {(filter, i) => (
                        <TvView
                          x={64 + i() * 158}
                          y={190}
                          w={140}
                          h={52}
                          rounded={26}
                          color={
                            sourceFilterFocus() && sourceFacet() === i()
                              ? palette.text
                              : (
                                    i() === 0
                                      ? sourceHeight() === undefined
                                      : "height" in filter &&
                                        filter.height === sourceHeight()
                                  )
                                ? "#34343A"
                                : "rgba(0,0,0,0)"
                          }
                        >
                          <Label
                            x={18}
                            centerY={26}
                            size={23}
                            font="Onest600"
                            content={`${filter.label} ${filter.count}`}
                            color={
                              sourceFilterFocus() && sourceFacet() === i()
                                ? "#111113"
                                : palette.muted
                            }
                          />
                        </TvView>
                      )}
                    </For>
                    <For
                      each={sources().slice(
                        Math.max(0, choice() - 4),
                        Math.max(0, choice() - 4) + 5,
                      )}
                    >
                      {(source, i) => (
                        <TvView
                          x={64}
                          y={270 + i() * 114}
                          w={800}
                          h={104}
                          rounded={12}
                          color={
                            i() + Math.max(0, choice() - 4) === choice() &&
                            !sourceFilterFocus()
                              ? palette.text
                              : "#212124"
                          }
                        >
                          <Label
                            x={28}
                            y={20}
                            size={28}
                            font="Onest700"
                            maxwidth={140}
                            content={source.view?.quality_label ?? ""}
                            color={
                              i() + Math.max(0, choice() - 4) === choice() &&
                              !sourceFilterFocus()
                                ? "#111113"
                                : palette.text
                            }
                          />
                          <Label
                            x={28}
                            y={60}
                            size={18}
                            maxwidth={120}
                            maxlines={1}
                            content={source.view?.format_label ?? ""}
                            color={
                              i() + Math.max(0, choice() - 4) === choice() &&
                              !sourceFilterFocus()
                                ? "#444444"
                                : palette.muted
                            }
                          />
                          <Label
                            x={164}
                            y={20}
                            size={27}
                            font="Onest700"
                            maxwidth={610}
                            maxlines={1}
                            content={
                              source.view?.title ??
                              source.name ??
                              source.title ??
                              "Source"
                            }
                            color={
                              i() + Math.max(0, choice() - 4) === choice() &&
                              !sourceFilterFocus()
                                ? "#111113"
                                : palette.text
                            }
                          />
                          <Show
                            when={source.id === sourcePage()?.best_match_id}
                          >
                            <TvView
                              x={
                                176 +
                                sourceLabelWidth(
                                  source.view?.title ??
                                    source.name ??
                                    source.title ??
                                    "Source",
                                )
                              }
                              y={22}
                              w={136}
                              h={30}
                              rounded={6}
                              color={
                                i() + Math.max(0, choice() - 4) === choice() &&
                                !sourceFilterFocus()
                                  ? "#111113"
                                  : "#34343A"
                              }
                            >
                              <Label
                                w={136}
                                centerY={15}
                                align="center"
                                size={18}
                                font="Onest700"
                                content="Best match"
                              />
                            </TvView>
                          </Show>
                          <Label
                            x={164}
                            y={60}
                            size={22}
                            maxwidth={610}
                            maxlines={1}
                            content={
                              source.view?.body ??
                              source.detail ??
                              source.description ??
                              ""
                            }
                            color={
                              i() + Math.max(0, choice() - 4) === choice() &&
                              !sourceFilterFocus()
                                ? "#444444"
                                : palette.muted
                            }
                          />
                        </TvView>
                      )}
                    </For>
                    <Show when={!sources().length && !sourceLoading()}>
                      <Label
                        x={64}
                        y={320}
                        size={28}
                        maxwidth={800}
                        content="No sources found. Try again or check your add-ons."
                      />
                    </Show>
                    <Label
                      x={64}
                      y={968}
                      size={22}
                      maxwidth={800}
                      maxlines={2}
                      color={palette.muted}
                      content={sourcePage()?.selection_note ?? ""}
                    />
                  </TvView>
                </Show>
                <Show
                  when={
                    (modal().kind === "choices" ||
                      modal().kind === "confirm") &&
                    !profileEditor()
                  }
                >
                  <TvView
                    x={overlayEntered() && !overlayClosing() ? 1100 : 1920}
                    w={820}
                    h={1080}
                    color={palette.surface}
                    transition={{
                      x: {
                        duration: overlayClosing() ? 200 : 300,
                        timingFunction: overlayClosing()
                          ? "cubic-bezier(.3,0,1,1)"
                          : "cubic-bezier(0,0,0,1)",
                      },
                    }}
                  >
                    <Label
                      x={64}
                      y={72}
                      size={44}
                      font="Onest700"
                      maxwidth={692}
                      maxlines={2}
                      content={modal().title}
                    />
                    <Label
                      x={64}
                      y={150}
                      size={22}
                      maxwidth={692}
                      maxlines={2}
                      color={palette.muted}
                      content={
                        (
                          modal() as Extract<
                            Overlay,
                            { kind: "choices" | "confirm" }
                          >
                        ).description ?? ""
                      }
                    />
                    <For
                      each={(
                        modal() as Extract<
                          Overlay,
                          { kind: "choices" | "confirm" }
                        >
                      ).items.slice(
                        Math.max(0, choice() - 5),
                        Math.max(0, choice() - 5) + 7,
                      )}
                    >
                      {(item, i) => (
                        <TvView
                          x={64}
                          y={230 + i() * 104}
                          w={692}
                          h={88}
                          rounded={12}
                          color={
                            i() + Math.max(0, choice() - 5) === choice()
                              ? palette.text
                              : "#212124"
                          }
                        >
                          <Label
                            x={24}
                            centerY={44}
                            size={26}
                            font="Onest600"
                            maxwidth={570}
                            maxlines={1}
                            content={item.label}
                            color={
                              i() + Math.max(0, choice() - 5) === choice()
                                ? "#111113"
                                : palette.text
                            }
                          />
                          <Label
                            x={600}
                            centerY={44}
                            size={22}
                            content={item.value ?? ""}
                            color={
                              i() + Math.max(0, choice() - 5) === choice()
                                ? "#111113"
                                : palette.text
                            }
                          />
                        </TvView>
                      )}
                    </For>
                  </TvView>
                </Show>
                <Show when={profileEditor()}>
                  {(editor) => {
                    const profile = () =>
                      management()?.profiles.find(
                        (p) => p.id === editor().profile!.id,
                      ) ?? editor().profile!;
                    return (
                      <TvView w={1920} h={1080} color={palette.bg}>
                        <Label
                          x={96}
                          y={96}
                          size={56}
                          font="Onest700"
                          content="Edit profile"
                        />
                        <TvView
                          x={156}
                          y={220}
                          w={280}
                          h={280}
                          rounded={28}
                          color={palette.surface}
                        >
                          <Show
                            when={avatar(profile().avatar_id)}
                            fallback={
                              <Label
                                w={280}
                                centerY={140}
                                align="center"
                                size={96}
                                font="Onest700"
                                content={profile().name.slice(0, 1)}
                              />
                            }
                          >
                            <TvView
                              w={280}
                              h={280}
                              rounded={28}
                              src={avatar(profile().avatar_id)}
                              fit="cover"
                            />
                          </Show>
                        </TvView>
                        <Show
                          when={editor().items.some(
                            (item) => item.id === "avatar",
                          )}
                        >
                          <Button
                            x={156}
                            y={524}
                            w={280}
                            label="Change avatar"
                            focused={editor().items[choice()]?.id === "avatar"}
                          />
                        </Show>
                        <For
                          each={editor().items.filter(
                            (item) => item.id !== "avatar",
                          )}
                        >
                          {(item, index) => (
                            <TvView
                              x={640}
                              y={
                                item.id === "delete" ? 784 : 220 + index() * 108
                              }
                              w={1184}
                              h={item.id === "delete" ? 80 : 96}
                              rounded={16}
                              color={
                                editor().items[choice()]?.id === item.id
                                  ? palette.text
                                  : "#1B1B1D"
                              }
                            >
                              <Label
                                x={28}
                                centerY={item.id === "delete" ? 40 : 48}
                                size={28}
                                font="Onest600"
                                content={item.label}
                                color={
                                  item.id === "delete"
                                    ? "#FF8A7E"
                                    : editor().items[choice()]?.id === item.id
                                      ? "#111113"
                                      : palette.text
                                }
                              />
                              <Label
                                x={720}
                                centerY={48}
                                w={430}
                                maxlines={1}
                                align="right"
                                size={26}
                                content={
                                  item.id === "rename"
                                    ? profile().name + "  ›"
                                    : ""
                                }
                                color={
                                  editor().items[choice()]?.id === item.id
                                    ? "#444444"
                                    : palette.muted
                                }
                              />
                            </TvView>
                          )}
                        </For>
                      </TvView>
                    );
                  }}
                </Show>
                <Show when={modal().kind === "tracks"}>
                  <TvView
                    y={540}
                    w={1920}
                    h={540}
                    rounded={24}
                    color={palette.surface}
                  >
                    <For
                      each={
                        (modal() as Extract<Overlay, { kind: "tracks" }>)
                          .columns
                      }
                    >
                      {(column, c) => (
                        <TvView x={96 + c() * 600}>
                          <Label
                            y={48}
                            size={24}
                            font="Onest600"
                            color={palette.muted}
                            content={column.title}
                          />
                          <For
                            each={column.items.slice(
                              c() === trackColumn()
                                ? Math.max(0, choice() - 4)
                                : 0,
                              (c() === trackColumn()
                                ? Math.max(0, choice() - 4)
                                : 0) + 5,
                            )}
                          >
                            {(item, i) => (
                              <TvView
                                x={-20}
                                y={92 + i() * 70}
                                w={520}
                                h={64}
                                rounded={12}
                                color={
                                  c() === trackColumn() &&
                                  i() + Math.max(0, choice() - 4) === choice()
                                    ? palette.text
                                    : "rgba(0,0,0,0)"
                                }
                              >
                                <Label
                                  x={20}
                                  centerY={32}
                                  size={24}
                                  content={item.value ?? ""}
                                  color={
                                    c() === trackColumn() &&
                                    i() + Math.max(0, choice() - 4) === choice()
                                      ? "#111113"
                                      : palette.text
                                  }
                                />
                                <Label
                                  x={60}
                                  centerY={32}
                                  size={26}
                                  maxwidth={440}
                                  maxlines={1}
                                  content={item.label}
                                  color={
                                    c() === trackColumn() &&
                                    i() + Math.max(0, choice() - 4) === choice()
                                      ? "#111113"
                                      : palette.text
                                  }
                                />
                              </TvView>
                            )}
                          </For>
                        </TvView>
                      )}
                    </For>
                  </TvView>
                </Show>
                <Show when={modal().kind === "text"}>
                  <TvView w={1920} h={1080} color={palette.bg}>
                    <Show
                      when={
                        (modal() as Extract<Overlay, { kind: "text" }>).numeric
                      }
                    >
                      <TvView
                        x={900}
                        y={150}
                        w={120}
                        h={120}
                        rounded={24}
                        color={palette.surface}
                      >
                        <TvView
                          x={32}
                          y={32}
                          w={56}
                          h={56}
                          src={icon("lock")}
                        />
                      </TvView>
                      <For
                        each={Array.from(
                          { length: Math.max(4, Math.min(8, text().length)) },
                          (_, i) => i,
                        )}
                      >
                        {(i) => (
                          <TvView
                            x={
                              (1920 -
                                Math.max(4, Math.min(8, text().length)) * 106 +
                                18) /
                                2 +
                              i * 106
                            }
                            y={380}
                            w={88}
                            h={104}
                            rounded={14}
                            color={
                              i === text().length ? palette.text : "#3B3B3A"
                            }
                          >
                            <TvView
                              x={2}
                              y={2}
                              w={84}
                              h={100}
                              rounded={12}
                              color="#202020"
                            />
                            <Show when={i < text().length}>
                              <TvView
                                x={33}
                                y={41}
                                w={22}
                                h={22}
                                rounded={11}
                                color={palette.text}
                              />
                            </Show>
                          </TvView>
                        )}
                      </For>
                    </Show>
                    <Label
                      x={
                        (modal() as Extract<Overlay, { kind: "text" }>).numeric
                          ? 0
                          : 96
                      }
                      w={
                        (modal() as Extract<Overlay, { kind: "text" }>).numeric
                          ? 1920
                          : 1728
                      }
                      align={
                        (modal() as Extract<Overlay, { kind: "text" }>).numeric
                          ? "center"
                          : "left"
                      }
                      y={
                        (modal() as Extract<Overlay, { kind: "text" }>).numeric
                          ? 300
                          : 80
                      }
                      size={44}
                      font="Onest700"
                      content={modal().title}
                    />
                    <TvView
                      show={
                        !(modal() as Extract<Overlay, { kind: "text" }>).numeric
                      }
                      x={96}
                      y={195}
                      w={1728}
                      h={88}
                      rounded={12}
                      color={palette.surface}
                    >
                      <Label
                        x={24}
                        centerY={44}
                        size={32}
                        maxwidth={1680}
                        maxlines={1}
                        content={
                          (modal() as Extract<Overlay, { kind: "text" }>).secret
                            ? "•".repeat(text().length)
                            : text()
                        }
                      />
                    </TvView>
                    {keyboard(true)}
                  </TvView>
                </Show>
              </>
            )}
          </Show>
          <Show when={error()}>
            <TvView
              x={400}
              y={340}
              w={1120}
              h={350}
              rounded={18}
              color={palette.surface}
            >
              <Label
                x={64}
                y={52}
                size={36}
                font="Onest700"
                content="Couldn’t continue"
              />
              <Label
                x={64}
                y={120}
                size={26}
                maxwidth={992}
                maxlines={2}
                content={error()}
                color={palette.body}
              />
              <Button
                x={64}
                y={230}
                w={320}
                label={screen() === "player" ? "Choose a source" : "Try again"}
                focused={true}
              />
            </TvView>
          </Show>
          <Show when={notice() || pending()}>
            <TvView
              x={560}
              y={960}
              w={800}
              h={72}
              rounded={12}
              color={palette.surface}
            >
              <Label
                w={800}
                centerY={36}
                align="center"
                size={24}
                content={pending() ? "Saving…" : notice()}
              />
            </TvView>
          </Show>
          <Show when={screenSaver()}>
            <TvView w={1920} h={1080} color="#0B0B0C">
              <PosterWall />
            </TvView>
            <TvView w={1920} h={1080} color="rgba(11,11,12,.72)" />
          </Show>
        </TvView>
      ),
    });
    return <Root />;
  };
}
