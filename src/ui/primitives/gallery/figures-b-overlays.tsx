/*
 * Gallery figures: overlays (agent B) on CmpPhone3 / CmpDesk3 / CmpTv3. Each figure mounts the
 * real overlay primitives over the reference screen behind it (figures-b-backdrop.tsx).
 * Forced states use data-force (see registry.ts).
 */
import type { CSSProperties, ReactNode } from "react";
import { BookmarkPlus, ChevronDown, CircleCheck, Delete, EyeOff, List, LogOut, Play, RotateCcw, SkipBack, Space, Trash2 } from "lucide-react";
import { Dialog, DialogText, Menu, MenuItem, MenuItemContent, Overlay, Popover, TvTextEntry, TvTextPanel } from "../Overlays";
import { StatusLine } from "../Feedback";
import { KbdHints } from "../Keys";
import { Backdrop } from "./figures-b-backdrop";
import { register } from "./registry";

const noop = () => undefined;
const sw = (w: number) => ({ strokeWidth: w });
const deskRegion: CSSProperties = { left: "var(--viptv-layout-desktop-rail)", top: 0, right: 0, bottom: 0 };

/*
 * Source rows belong to cards.css (agent A). Until that primitive lands the list sheet / drawer
 * figures draw the reference row inline (reference geometry, gallery only).
 */
function RefSourceRow({ quality, name, file, best, hover, desk }: { quality: string; name: string; file: string; best?: boolean; hover?: boolean; desk?: boolean }) {
  const row: CSSProperties = {
    width: "100%", minHeight: desk ? "var(--viptv-size-source-row-desktop)" : "var(--viptv-size-source-row-phone)",
    padding: desk ? "10px 14px" : "12px 14px", boxSizing: "border-box",
    border: best ? "var(--viptv-size-border-focus) solid var(--viptv-accent)" : "1px solid var(--viptv-color-line-hairline)",
    borderRadius: desk ? "var(--viptv-radius-xl)" : "var(--viptv-radius-xl-plus)",
    background: hover ? "var(--viptv-color-surface-3)" : "var(--viptv-color-surface-2)",
    display: "flex", alignItems: "center", gap: 14, textAlign: "left", color: "var(--viptv-color-text-primary)",
  };
  const badge: CSSProperties = {
    width: desk ? 54 : 56, height: desk ? 40 : 44, flex: "none", borderRadius: desk ? 10 : 12,
    background: hover ? "var(--viptv-color-surface-4)" : "var(--viptv-color-surface-3)",
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700,
  };
  return (
    <button type="button" style={row} aria-label={`Play from ${name}, ${quality}`}>
      <span style={badge}>{quality}</span>
      <span style={{ flexGrow: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
        {best ? <span className="vx-eyebrow vx-eyebrow--accent">Best match</span> : null}
        <span style={{ fontSize: desk ? 15 : 16, fontWeight: 600 }}>{name}</span>
        <span style={{ fontSize: 13, color: "var(--viptv-color-text-tertiary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{file}</span>
      </span>
      <Play width={desk ? 16 : 18} height={desk ? 16 : 18} fill="currentColor" style={{ color: hover ? "var(--viptv-color-text-primary)" : "var(--viptv-color-text-secondary)", flex: "none" }} />
    </button>
  );
}
const sources = (desk: boolean, hover?: boolean) => <>
  <RefSourceRow desk={desk} best quality="1080p" name="LordStreams" file="The End of Oak Street - 2026 · HTTP" />
  <RefSourceRow desk={desk} hover={hover} quality="1080p" name="ThisIPTV" file="The End of Oak Street (2026) · HTTP" />
  <RefSourceRow desk={desk} quality="720p" name="LucidHosting" file="The End of Oak Street (2026) · HTTP" />
</>;

const detailText = (title: string, file: string) => `LordStreams\n\n${title}\n\n[${file}]\n\nLordStreams`;
const titleMenu = (focusIndex: number | null, force: "hover" | "focus") => (
  <Menu label="Title menu">
    {[
      [<SkipBack {...sw(2)} />, "Resume previous episode"],
      [<List {...sw(2)} />, "Choose source"],
      [<CircleCheck {...sw(2)} />, "Mark watched"],
      [<RotateCcw {...sw(2)} />, "Watch from the beginning"],
      [<EyeOff {...sw(2)} />, "Remove from Continue Watching"],
      [<BookmarkPlus {...sw(2)} />, "Add to My List"],
    ].map(([icon, label], index) => (
      <MenuItem key={index} icon={icon} data-force={index === focusIndex ? force : undefined}>{label}</MenuItem>
    ))}
  </Menu>
);
const btn = (label: ReactNode, extra = "", force?: string) => <button type="button" className={`vx-btn ${extra}`.trim()} data-force={force}>{label}</button>;

/* ---------- Phone: bottom sheets ---------- */
const phone = (caption: string, overlay: ReactNode) => () => (
  <Backdrop figure={`CmpPhone3:${caption}`}><Overlay onScrimClick={noop}>{overlay}</Overlay></Backdrop>
);
register("CmpPhone3", {
  "List sheet": phone("List sheet",
    <Dialog variant="drawer" title="Choose a source" meta="12 sources" onClose={noop}
      head={<StatusLine>Finding sources…</StatusLine>}
      tools={<>
        <button type="button" className="vx-chip" aria-pressed="true"><span>All</span></button>
        <button type="button" className="vx-chip" aria-pressed="false"><span>1080p</span><span className="vx-chip__count">5</span></button>
        <button type="button" className="vx-btn vx-btn--outline" aria-haspopup="dialog">All providers<ChevronDown {...sw(2.2)} /></button>
      </>}>
      {sources(false)}
    </Dialog>),
  "Dialog sheet · 1 choice": phone("Dialog sheet · 1 choice",
    <Dialog title="Source details" onClose={noop} actions={btn("Close")}>
      <DialogText detail>{detailText("The End of Oak Street - 2026", "The.End.of.Oak.Street.2026.1080p.WEB.mkv")}</DialogText>
    </Dialog>),
  "Dialog sheet · 2 choices": phone("Dialog sheet · 2 choices",
    <Dialog title="Sign out of this device?" onClose={noop} actions={<>
      {btn(<><LogOut {...sw(2)} />Sign out</>, "vx-btn--destructive vx-btn--lead")}
      {btn("Cancel")}
    </>} />),
  "Dialog sheet · 3 choices": phone("Dialog sheet · 3 choices",
    <Dialog title="This source could not be played" onClose={noop} actions={<>
      {btn("Retry", "vx-btn--primary")}{btn("Choose another source")}{btn("Back")}
    </>}>
      <DialogText>The selected source did not become ready in time.</DialogText>
    </Dialog>),
  "Dialog sheet · 7 choices": phone("Dialog sheet · 7 choices",
    <Dialog title="Monster: The Jeffrey Dahmer Story" onClose={noop} actions={btn("Cancel")}>{titleMenu(null, "hover")}</Dialog>),
  "Dialog sheet · destructive": phone("Dialog sheet · destructive",
    <Dialog title="Delete profile" onClose={noop} actions={<>
      {btn("Cancel")}
      {btn(<><Trash2 {...sw(2)} />Delete profile</>, "vx-btn--destructive vx-btn--lead")}
    </>}>
      <DialogText>Delete zayne? This permanently removes this profile's watch history, favorites and preferences.</DialogText>
    </Dialog>),
  "Dialog sheet · choice list": phone("Dialog sheet · choice list",
    <Dialog title="Maximum quality" onClose={noop} actions={btn("Cancel")}>
      <Menu label="Maximum quality" role="listbox">
        {["Auto", "1080p", "720p", "480p"].map((label, index) => (
          <MenuItem key={label} role="option" current={index === 0} aria-selected={index === 0}>{label}</MenuItem>
        ))}
      </Menu>
    </Dialog>),
});

/* ---------- Desktop: centred dialogs, popover, drawer (scrim over the body row only) ---------- */
const desk = (caption: string, overlay: ReactNode, scrim = true) => () => (
  <Backdrop figure={`CmpDesk3:${caption}`} region={deskRegion}>
    {scrim ? <Overlay onScrimClick={noop}>{overlay}</Overlay> : overlay}
  </Backdrop>
);
register("CmpDesk3", {
  "Centred dialog · 1 choice": desk("Centred dialog · 1 choice",
    <Dialog title="Source details" onClose={noop} actions={btn("Close")}>
      <DialogText detail>{detailText("The End of Oak Street - 2026", "The.End.of.Oak.Street.2026.1080p.WEB.mkv")}</DialogText>
    </Dialog>),
  "Centred dialog · 2 choices, destructive": desk("Centred dialog · 2 choices, destructive",
    <Dialog title="Sign out of this device?" onClose={noop} actions={<>
      {btn(<><LogOut {...sw(2)} />Sign out</>, "vx-btn--destructive vx-btn--lead")}
      {btn("Cancel")}
    </>} />),
  "Centred dialog · 3 choices": desk("Centred dialog · 3 choices",
    <Dialog title="This source could not be played" onClose={noop} actions={<>
      {btn("Retry", "vx-btn--primary")}{btn("Choose another source")}{btn("Back")}
    </>}>
      <DialogText>The selected source did not become ready in time.</DialogText>
    </Dialog>),
  "Centred dialog · 7 choices": desk("Centred dialog · 7 choices",
    <Dialog title="Monster: The Jeffrey Dahmer Story" onClose={noop} actions={btn("Cancel")}>{titleMenu(1, "hover")}</Dialog>),
  "Anchored popover · menu for one control": desk("Anchored popover · menu for one control",
    // Anchored under the provider control (CmpDesk3: 560, 150 in the body row).
    <Popover label="Source provider" style={{ left: 476, top: 150 }}>
      <div className="vx-menu" role="none">
        {["All", "LordStreams", "ThisIPTV", "LucidHosting", "ProxPanel Fans"].map((label, index) => (
          <button key={label} type="button" role="menuitemradio" aria-checked={index === 0} className="vx-menu__item" data-force={index === 2 ? "hover" : undefined}>
            <MenuItemContent current={index === 0}>{label}</MenuItemContent>
          </button>
        ))}
      </div>
    </Popover>, false),
  "Right drawer": desk("Right drawer",
    <Dialog variant="drawer" title="Choose a source" onClose={noop}
      head={<StatusLine>12 sources · Finding sources…</StatusLine>}
      tools={<>
        <div className="vx-segmented vx-segmented--drawer" role="group" aria-label="Quality">
          {["All", "4K", "1080p", "720p"].map((label, index) => <button key={label} type="button" className="vx-segmented__item" aria-pressed={index === 0}>{label}</button>)}
        </div>
        <button type="button" className="vx-btn vx-btn--outline" aria-haspopup="dialog">All providers<ChevronDown {...sw(2.2)} /></button>
      </>}
      footer={<KbdHints hints={[{ keys: ["↑", "↓"], label: "Move" }, { keys: ["Enter"], label: "Play" }, { keys: ["Esc"], label: "Close" }]} />}>
      {sources(true, true)}
    </Dialog>),
});

/* ---------- TV: right panels and full-screen layouts ---------- */
const tv = (caption: string, overlay: ReactNode, scrim: "default" | "fullscreen" | "solid" = "default") => () => (
  <Backdrop figure={`CmpTv3:${caption}`}><Overlay scrim={scrim}>{overlay}</Overlay></Backdrop>
);
const tvRow = (label: string, extra = "", focused = false) => btn(label, extra, focused ? "focus" : undefined);
const letters = "abcdefghijklmnopqrstuvwxyz1234567890:/.-_@".split("");
register("CmpTv3", {
  "Panel · 1 choice": tv("Panel · 1 choice",
    <Dialog title="Source details" actions={tvRow("Close", "", true)}>
      <DialogText detail>{detailText("Monster: The Jeffrey Dahmer Story", "Monster.S01E01.1080p.WEB.mkv")}</DialogText>
    </Dialog>),
  "Panel · 2 choices, destructive": tv("Panel · 2 choices, destructive",
    <Dialog title="Sign out of this TV?" actions={<>{tvRow("Sign out", "vx-btn--destructive")}{tvRow("Cancel", "", true)}</>} />),
  "Panel · 3 choices": tv("Panel · 3 choices",
    <Dialog title="This source could not be played" actions={<>{tvRow("Retry", "", true)}{tvRow("Choose another source")}{tvRow("Back")}</>}>
      <DialogText>The selected source did not become ready in time.</DialogText>
    </Dialog>),
  "Panel · 7 choices": tv("Panel · 7 choices",
    <Dialog title="Monster: The Jeffrey Dahmer Story" actions={tvRow("Cancel")}>{titleMenu(1, "focus")}</Dialog>),
  "Full-screen text entry": tv("Full-screen text entry",
    <TvTextEntry
      title="Profile name"
      field={<span className="vx-field"><span className="vx-field__control"><span className="vx-field__value">zayne<span className="vx-caret" /></span></span></span>}
      hint="Select to type with your remote or a connected keyboard."
      count="5 / 64"
      keys={
        <div className="vx-keyboard">
          <div className="vx-keyboard__keys">
            {letters.map((key) => <button key={key} type="button" className="vx-key" data-force={key === "e" ? "focus" : undefined}>{key}</button>)}
            <button type="button" className="vx-key vx-key--action" aria-label="Shift">Aa</button>
            <button type="button" className="vx-key vx-key--action vx-key--span-3" aria-label="Space"><Space {...sw(2)} /></button>
            <button type="button" className="vx-key vx-key--action vx-key--span-2" aria-label="Delete"><Delete {...sw(2)} /></button>
          </div>
          <div className="vx-keyboard__actions"><button type="button" className="vx-btn">Done</button><button type="button" className="vx-btn">Cancel</button></div>
        </div>
      }
    />, "solid"),
  "Full-screen text panel": tv("Full-screen text panel",
    <TvTextPanel
      title="The End of Oak Street"
      meta="2026 · 1 h 40 min · Action · Adventure · Mystery"
      boxLabel="The End of Oak Street text, scroll with up and down"
      boxProps={{ "data-force": "focus" }}
      actions={<button type="button" className="vx-btn">Close</button>}
    >
      <p>The Platt family bands together to navigate their new surroundings after a cosmic event transports their suburban neighborhood to someplace unknown.</p>
      <p>Director: [Name]</p>
      <p>Cast: Anne Hathaway, Ewan McGregor, Maisy Stella</p>
    </TvTextPanel>, "fullscreen"),
});
