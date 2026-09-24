/*
 * Gallery figures for agent A's primitives on the control sheets (CmpPhone1,
 * CmpDesk1, CmpTv1): buttons, chips, badges, progress, spinner, fields, toggles.
 * Wrapper widths reproduce the reference figure geometry (reference data, DEV only).
 */
import type { CSSProperties, ReactNode } from "react";
import { Check, ChevronDown, CircleAlert, Compass, Delete, Ellipsis, LogOut, Plus, Search, Space, Trash, X } from "lucide-react";
import { PlayIcon } from "../icons";
import { register } from "./registry";
import "./figures-a-cards";

const box = (width: number | string, children: ReactNode, style: CSSProperties = {}) => (
  <div style={{ width, display: "flex", gap: 10, ...style }}>{children}</div>
);
const col = (width: number | string, gap: number, children: ReactNode) => (
  <div style={{ width, display: "flex", flexDirection: "column", gap }}>{children}</div>
);
const sw = (w: number) => ({ strokeWidth: w });

/* ---------- shared figure builders ---------- */

function Field({ label, value, placeholder, caret, force, error, disabled, mono, srLabel, message }: {
  label: string; value?: string; placeholder?: string; caret?: boolean; force?: boolean; error?: boolean;
  disabled?: boolean; mono?: boolean; srLabel?: boolean; message?: string;
}) {
  const classes = ["vx-field", error && "vx-field--error", disabled && "vx-field--disabled", mono && "vx-field--mono"].filter(Boolean).join(" ");
  return (
    <label className={classes}>
      {srLabel ? null : <span className="vx-field__label">{label}</span>}
      <span className="vx-field__control" data-force={force ? "focus-within" : undefined} tabIndex={force ? -1 : undefined}>
        {value !== undefined
          ? <span className="vx-field__value">{value}{caret ? <span className="vx-caret" /> : null}</span>
          : placeholder !== undefined
            ? <span className="vx-field__placeholder">{placeholder}</span>
            : <input className="vx-field__input" aria-label={label} disabled={disabled} />}
      </span>
      {message ? <span className="vx-inline-error" role="alert"><CircleAlert {...sw(2.2)} />{message}</span> : null}
      {srLabel ? <span className="vx-sr-only">{label}</span> : null}
    </label>
  );
}

function Pin({ filled, active, total = 6, error, message }: { filled: number; active?: boolean; total?: number; error?: boolean; message?: string }) {
  const boxes = Array.from({ length: total }, (_, index) => {
    const cls = index < filled ? "vx-pin__box vx-pin__box--filled" : index === filled && active ? "vx-pin__box vx-pin__box--active" : "vx-pin__box";
    return <span key={index} className={cls} />;
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
      <div className={error ? "vx-pin vx-pin--error" : "vx-pin"} role="group" aria-label={`Parent PIN, ${filled} of 4 to 8 digits entered`}>{boxes}</div>
      {message ? <span className="vx-inline-error" role="alert"><CircleAlert {...sw(2.2)} />{message}</span> : null}
    </div>
  );
}

const Current = ({ label = "Current" }: { label?: string }) => (
  <span className="vx-choice__current"><Check {...sw(2.6)} />{label}</span>
);

/* ---------- Phone ---------- */

register("CmpPhone1", {
  "Primary · default": () => box(218, <button className="vx-btn vx-btn--primary vx-btn--lead vx-btn--block" style={{ flexGrow: 1 }}><PlayIcon />Play</button>),
  "Primary · pressed": () => box(218, <button className="vx-btn vx-btn--primary vx-btn--lead vx-btn--block" data-force="active"><PlayIcon />Play</button>),
  "Primary · disabled": () => box(218, <button className="vx-btn vx-btn--primary vx-btn--block" disabled>Create profile</button>),
  "Primary · loading": () => box(218, <button className="vx-btn vx-btn--primary vx-btn--lead vx-btn--block" aria-busy="true"><span className="vx-spinner" aria-hidden="true" />Signing in…</button>),
  "Primary 58 · detail": () => box(218, <button className="vx-btn vx-btn--primary vx-btn--detail vx-btn--lead vx-btn--block"><PlayIcon />Play</button>),
  "Secondary · default": () => box(218, <button className="vx-btn vx-btn--block">Cancel</button>),
  "Secondary · pressed": () => box(218, <button className="vx-btn vx-btn--block" data-force="active">Cancel</button>),
  "Secondary · disabled": () => box(218, <button className="vx-btn vx-btn--block" disabled>Cancel</button>),
  "Light pill · default": () => <button className="vx-btn vx-btn--light vx-btn--pill">Add an addon</button>,
  "Light pill · pressed": () => <button className="vx-btn vx-btn--light vx-btn--pill" data-force="active">Add an addon</button>,
  "Outline dropdown · default": () => <button className="vx-btn vx-btn--outline" aria-haspopup="dialog">All providers<ChevronDown {...sw(2.2)} /></button>,
  "Outline dropdown · pressed": () => <button className="vx-btn vx-btn--outline" aria-haspopup="dialog" data-force="active">All providers<ChevronDown {...sw(2.2)} /></button>,
  "Round icon 54 · states": () => <>
    <button className="vx-btn vx-btn--icon" aria-label="Add to My List"><Plus {...sw(2.2)} /></button>
    <button className="vx-btn vx-btn--icon" aria-label="Add to My List" data-force="active"><Plus {...sw(2.2)} /></button>
    <button className="vx-btn vx-btn--icon" aria-label="Add to My List" disabled><Plus {...sw(2.2)} /></button>
  </>,
  "Round icon 58 · detail": () => <>
    <button className="vx-btn vx-btn--icon vx-btn--detail" aria-label="Add to My List"><Plus {...sw(2.2)} /></button>
    <button className="vx-btn vx-btn--icon vx-btn--detail" aria-label="More options"><Ellipsis {...sw(2.2)} /></button>
  </>,
  "Text link · shelf / inline": () => <><a href="#" className="vx-link vx-link--plain">See all</a><a href="#" className="vx-link">Reconnect</a></>,
  "Text link · pressed": () => <a href="#" className="vx-link" data-force="active">Reconnect</a>,
  "Destructive · default": () => box(218, <button className="vx-btn vx-btn--destructive vx-btn--lead vx-btn--block"><LogOut {...sw(2.2)} />Sign out</button>),
  "Destructive · pressed": () => box(218, <button className="vx-btn vx-btn--destructive vx-btn--lead vx-btn--block" data-force="active"><LogOut {...sw(2.2)} />Sign out</button>),

  "Filter chip · unselected": () => <button className="vx-chip" aria-pressed="false"><span>Seasonal</span></button>,
  "Filter chip · selected": () => <button className="vx-chip" aria-pressed="true"><span>Popular</span></button>,
  "Filter chip · pressed": () => <button className="vx-chip" aria-pressed="false" data-force="active"><span>Seasonal</span></button>,
  "Filter chip · disabled": () => <button className="vx-chip" aria-pressed="false" disabled><span>Seasonal</span></button>,
  "Dropdown chip": () => <button className="vx-chip vx-chip--dropdown" aria-haspopup="dialog"><span className="vx-chip__key">Genre:</span><span>Any</span><ChevronDown {...sw(2.2)} /></button>,
  "Dropdown chip · set": () => <button className="vx-chip vx-chip--dropdown vx-chip--set" aria-haspopup="dialog"><span className="vx-chip__key">Genre:</span><span>[Comedy]</span><ChevronDown {...sw(2.2)} /></button>,
  "Required chip": () => <button className="vx-chip vx-chip--dropdown" aria-haspopup="dialog"><span>Year</span><span className="vx-chip__tag">Required</span><ChevronDown {...sw(2.2)} /></button>,
  "Quality chips · counts": () => <>
    <button className="vx-chip" aria-pressed="true"><span>All</span></button>
    <button className="vx-chip" aria-pressed="false"><span>1080p</span><span className="vx-chip__count">5</span></button>
    <button className="vx-chip" aria-pressed="false"><span>720p</span><span className="vx-chip__count">4</span></button>
  </>,
  "Segmented · 4 (44 h)": () => box(358, <div className="vx-segmented" role="group" aria-label="Type">
    <button className="vx-segmented__item" aria-pressed="true">Movies</button>
    <button className="vx-segmented__item" aria-pressed="false">Series</button>
    <button className="vx-segmented__item" aria-pressed="false">Anime</button>
    <button className="vx-segmented__item" aria-pressed="false">Other</button>
  </div>),
  "Segmented · 2": () => box(358, <div className="vx-segmented" role="group" aria-label="My List">
    <button className="vx-segmented__item" aria-pressed="false">My List</button>
    <button className="vx-segmented__item" aria-pressed="true">Continue Watching</button>
  </div>),
  "Group divider": () => <>
    <button className="vx-chip" aria-pressed="true"><span>Movies</span></button>
    <span className="vx-chip-divider" aria-hidden="true" />
    <button className="vx-chip" aria-pressed="false"><span>Popular</span></button>
  </>,

  "Quality badge": () => <>{["4K", "1080p", "720p", "SD"].map((q) => <span key={q} className="vx-badge vx-badge--quality">{q}</span>)}</>,
  "LIVE · glass / row": () => <>
    <span className="vx-badge vx-badge--live"><span className="vx-badge__dot" />LIVE</span>
    <span className="vx-live-label"><span className="vx-live-dot" />Live</span>
  </>,
  "Featured · glass": () => <span className="vx-badge vx-badge--featured">Featured</span>,
  "UP NEXT": () => <span className="vx-badge vx-badge--up-next">Up next</span>,
  "Best match": () => <span className="vx-eyebrow vx-eyebrow--accent">Best match</span>,
  "Progress 4 px / 3 px": () => col(180, 14, <>
    <span className="vx-progress" role="progressbar" aria-valuenow={58} aria-valuemin={0} aria-valuemax={100}><span className="vx-progress__fill" style={{ width: "58%" }} /></span>
    <span className="vx-progress vx-progress--small" role="progressbar" aria-valuenow={40} aria-valuemin={0} aria-valuemax={100}><span className="vx-progress__fill" style={{ width: "40%" }} /></span>
  </>),
  "Live dot": () => <span className="vx-live-dot" aria-hidden="true" />,
  "Carousel dots": () => <span className="vx-dots" aria-hidden="true"><span className="vx-dots__dot" aria-current="true" /><span className="vx-dots__dot" /><span className="vx-dots__dot" /><span className="vx-dots__dot" /><span className="vx-dots__dot" /></span>,
  "Spinner 12": () => <span className="vx-spinner" aria-hidden="true" />,
  "Buffering ring 48": () => <span className="vx-spinner vx-spinner--buffering" role="status" aria-label="Buffering" />,

  "Text field · default": () => box(300, <Field label="Username" />),
  "Text field · focus": () => box(300, <Field label="Username" value="vynxc" caret force />),
  "Text field · error": () => box(300, <Field label="Password" value="••••••••" error message="The username or password is incorrect." />),
  "Text field · disabled": () => box(300, <Field label="Username" value="vynxc" disabled />),
  "Password": () => box(300, <Field label="Password" value="••••••••" />),
  "PIN · entering": () => <Pin filled={3} active />,
  "PIN · error": () => <Pin filled={4} error message="Incorrect PIN. Try again." />,
  "URL · prefilled": () => box(300, <Field label="Install addon manifest URL" value="https://" caret force mono />),
  "URL · error": () => box(300, <Field label="Install addon manifest URL" value="http://[addon.example]/manifest.json" error mono message="Enter an HTTPS manifest URL." />),
  "Search · docked, empty": () => box(330, <label className="vx-search"><Search {...sw(2.2)} /><input className="vx-search__input" type="search" placeholder="Search movies and series" /><span className="vx-sr-only">Search</span></label>),
  "Search · typing": () => box(330, <label className="vx-search" data-force="focus-within"><Search {...sw(2.2)} /><span className="vx-field__value">[naruto]<span className="vx-caret" /></span><button className="vx-search__clear" aria-label="Clear search"><X {...sw(2.2)} /></button><span className="vx-sr-only">Search</span></label>),

  "Toggle · on / off / disabled": () => <>
    <button className="vx-switch" role="switch" aria-checked="true" aria-label="Toggle" />
    <button className="vx-switch" role="switch" aria-checked="false" aria-label="Toggle" />
    <button className="vx-switch" role="switch" aria-checked="true" aria-label="Toggle" disabled />
  </>,
  "Choice list · Current marker": () => col(358, 0, <div className="vx-choice-list" role="radiogroup" aria-label="Maximum quality">
    <button className="vx-choice" aria-current="true"><span className="vx-choice__label">Auto</span><Current /></button>
    <button className="vx-choice"><span className="vx-choice__label">1080p</span></button>
    <button className="vx-choice"><span className="vx-choice__label">720p</span></button>
    <button className="vx-choice"><span className="vx-choice__label">480p</span></button>
  </div>),
  "Choice rows · pressed / unavailable": () => col(358, 0, <div className="vx-choice-list">
    <button className="vx-choice" data-force="active"><span className="vx-choice__label">[English]</span></button>
    <button className="vx-choice" disabled><span className="vx-choice__label">[Portuguese (PGS)] (unavailable)</span></button>
  </div>),
  "Radio rows · settings choice": () => col(358, 0, <div className="vx-choice-list" role="radiogroup" aria-label="Subtitle size">
    <button className="vx-choice" role="radio" aria-checked="false"><span className="vx-radio" aria-hidden="true" /><span className="vx-choice__label">Small</span></button>
    <button className="vx-choice" role="radio" aria-checked="true"><span className="vx-radio" aria-hidden="true" /><span className="vx-choice__label">System default</span><Current /></button>
    <button className="vx-choice" role="radio" aria-checked="false"><span className="vx-radio" aria-hidden="true" /><span className="vx-choice__label">Large</span></button>
  </div>),
});

/* ---------- Desktop & web ---------- */

const deskPrimary = (force?: string, disabled?: boolean) => <button className="vx-btn vx-btn--primary vx-btn--lead" data-force={force} disabled={disabled}><PlayIcon />Play</button>;
const deskSecondary = (force?: string, disabled?: boolean) => <button className="vx-btn" data-force={force} disabled={disabled}>Details</button>;
const deskLight = (force?: string) => <button className="vx-btn vx-btn--light vx-btn--pill vx-btn--lead" data-force={force}><Compass {...sw(2)} />Browse Discover</button>;
const deskOutline = (force?: string) => <button className="vx-btn vx-btn--outline" aria-haspopup="dialog" data-force={force}>All providers<ChevronDown {...sw(2.2)} /></button>;
const deskRound = (force?: string, disabled?: boolean) => <button className="vx-btn vx-btn--icon" aria-label="Add to My List" data-force={force} disabled={disabled}><Plus {...sw(2.2)} /></button>;
const deskLink = (force?: string) => <a href="#" className="vx-link" data-force={force}>Create an account or recover access</a>;
const deskDestructive = (force?: string) => <button className="vx-btn vx-btn--destructive vx-btn--lead" data-force={force}><LogOut {...sw(2)} />Sign out</button>;
const split = (main?: string, more?: string) => (
  <div className="vx-split">
    <button className="vx-split__main" data-force={main}><PlayIcon />Play</button>
    <button className="vx-split__more" aria-label="Choose source" aria-haspopup="dialog" data-force={more}><ChevronDown {...sw(2.2)} /></button>
  </div>
);
const chip = (label: string, pressed: boolean, force?: string, disabled?: boolean, drawer?: boolean) => (
  <button className={drawer ? "vx-chip vx-chip--drawer" : "vx-chip"} aria-pressed={pressed} data-force={force} disabled={disabled}><span>{label}</span></button>
);
const segmented = (items: string[], selected: number, focus?: number, drawer?: boolean) => (
  <div className={drawer ? "vx-segmented vx-segmented--drawer" : "vx-segmented"} role="group" aria-label="Filter">
    {items.map((item, index) => <button key={item} className="vx-segmented__item" aria-pressed={index === selected} data-force={index === focus ? "focus-visible" : undefined}>{item}</button>)}
  </div>
);

register("CmpDesk1", {
  "Primary · default": () => deskPrimary(),
  "Primary · hover": () => deskPrimary("hover"),
  "Primary · pressed": () => deskPrimary("hover active"),
  "Primary · keyboard focus": () => deskPrimary("focus focus-visible"),
  "Primary · disabled": () => deskPrimary(undefined, true),
  "Primary · loading": () => <button className="vx-btn vx-btn--primary vx-btn--lead" aria-busy="true"><span className="vx-spinner" aria-hidden="true" />Saving…</button>,
  "Secondary · default": () => deskSecondary(),
  "Secondary · hover": () => deskSecondary("hover"),
  "Secondary · pressed": () => deskSecondary("hover active"),
  "Secondary · keyboard focus": () => deskSecondary("focus focus-visible"),
  "Secondary · disabled": () => deskSecondary(undefined, true),
  "Light pill · default": () => deskLight(),
  "Light pill · hover": () => deskLight("hover"),
  "Light pill · pressed": () => deskLight("hover active"),
  "Light pill · keyboard focus": () => deskLight("focus focus-visible"),
  "Outline dropdown · default": () => deskOutline(),
  "Outline dropdown · hover": () => deskOutline("hover"),
  "Outline dropdown · keyboard focus": () => deskOutline("focus focus-visible"),
  "Round icon 48 · default": () => deskRound(),
  "Round icon 48 · hover": () => deskRound("hover"),
  "Round icon 48 · pressed": () => deskRound("hover active"),
  "Round icon 48 · keyboard focus": () => deskRound("focus focus-visible"),
  "Round icon 48 · disabled": () => deskRound(undefined, true),
  "Text link · default": () => deskLink(),
  "Text link · hover": () => deskLink("hover"),
  "Text link · keyboard focus": () => deskLink("focus focus-visible"),
  "Destructive · default": () => deskDestructive(),
  "Destructive · hover": () => deskDestructive("hover"),
  "Destructive · keyboard focus": () => deskDestructive("focus focus-visible"),
  "Split button · default": () => split(),
  "Split button · hover": () => split("hover"),
  "Split button · source hover": () => split(undefined, "hover"),
  "Split button · focus": () => split("focus focus-visible"),

  "Chip · unselected": () => chip("Seasonal", false),
  "Chip · selected": () => chip("Popular", true),
  "Chip · hover": () => chip("Seasonal", false, "hover"),
  "Chip · focus": () => chip("Seasonal", false, "focus focus-visible"),
  "Chip · disabled": () => chip("Seasonal", false, undefined, true),
  "Dropdown chip · Any": () => <button className="vx-chip vx-chip--dropdown" aria-haspopup="dialog"><span className="vx-chip__key">Genre:</span><span>Any</span><ChevronDown {...sw(2.2)} /></button>,
  "Dropdown chip · set": () => <button className="vx-chip vx-chip--dropdown vx-chip--set" aria-haspopup="dialog"><span className="vx-chip__key">Genre:</span><span>[Comedy]</span><ChevronDown {...sw(2.2)} /></button>,
  "Required chip": () => <button className="vx-chip vx-chip--dropdown" aria-haspopup="dialog"><span>Year</span><span className="vx-chip__tag">Required</span><ChevronDown {...sw(2.2)} /></button>,
  "Catalog chip": () => <button className="vx-chip vx-chip--dropdown" aria-haspopup="dialog"><span>Cinemeta · Popular</span><ChevronDown {...sw(2.2)} /></button>,
  "Quality chips · counts": () => <>
    {chip("All", true)}
    <button className="vx-chip" aria-pressed="false"><span>1080p</span><span className="vx-chip__count">5</span></button>
    <button className="vx-chip" aria-pressed="false"><span>720p</span><span className="vx-chip__count">4</span></button>
  </>,
  "Segmented 40 h": () => segmented(["Movies", "Series", "Anime", "Other"], 0),
  "Segmented · focus on item": () => segmented(["Movies", "Series", "Anime", "Other"], 0, 1),
  "Segmented 36 h (drawer)": () => segmented(["All", "4K", "1080p", "720p"], 0, undefined, true),
  "Group divider": () => <>{segmented(["Movies", "Series"], 0)}<span className="vx-chip-divider" aria-hidden="true" />{chip("Popular", true)}</>,

  "Quality badge": () => <>{["4K", "1080p", "720p", "SD"].map((q) => <span key={q} className="vx-badge vx-badge--quality">{q}</span>)}</>,
  "LIVE · glass": () => <span className="vx-badge vx-badge--live"><span className="vx-badge__dot" />LIVE</span>,
  "UP NEXT": () => <span className="vx-badge vx-badge--up-next">Up next</span>,
  "Featured eyebrow": () => <span className="vx-eyebrow">Featured movie</span>,
  "Best match": () => <span className="vx-eyebrow vx-eyebrow--accent">Best match</span>,
  "Progress 4 px": () => box(180, <span className="vx-progress" role="progressbar" aria-valuenow={58} aria-valuemin={0} aria-valuemax={100}><span className="vx-progress__fill" style={{ width: "58%" }} /></span>),
  "Live dot": () => <span className="vx-live-dot" aria-hidden="true" />,
  "Carousel dots": () => <span className="vx-dots vx-dots--over-art" aria-hidden="true"><span className="vx-dots__dot" aria-current="true" /><span className="vx-dots__dot" /><span className="vx-dots__dot" /><span className="vx-dots__dot" /><span className="vx-dots__dot" /></span>,
  "Spinner 12": () => <span className="vx-spinner" aria-hidden="true" />,
  "Buffering ring 48": () => <span className="vx-spinner vx-spinner--buffering" role="status" aria-label="Buffering" />,

  "Text field · default": () => box(320, <Field label="Username" />),
  "Text field · focus": () => box(320, <Field label="Username" value="vynxc" caret force />),
  "Text field · error": () => box(320, <Field label="Username" value="vynxc" error message="The username or password is incorrect." />),
  "Text field · disabled": () => box(320, <Field label="Username" value="vynxc" disabled />),
  "Password": () => box(320, <Field label="Password" value="••••••••" />),
  "PIN · entering": () => <Pin filled={3} active />,
  "PIN · error": () => <Pin filled={2} error message="Enter a 4–8 digit parent PIN" />,
  "URL · prefilled": () => box(380, <Field label="Install addon manifest URL" value="https://" caret force mono />),
  "URL · error": () => box(380, <Field label="Install addon manifest URL" value="http://[addon.example]/manifest.json" error mono message="Enter an HTTPS manifest URL." />),
  "Web page search": () => box(420, <label className="vx-search vx-search--page" data-force="focus-within"><Search {...sw(2.2)} /><span className="vx-field__value">naruto<span className="vx-caret" /></span><button className="vx-search__clear" aria-label="Clear search"><X {...sw(2.2)} /></button><span className="vx-sr-only">Search</span></label>),
  "Title-bar search · idle": () => <label className="vx-search vx-search--titlebar"><Search {...sw(2.2)} /><input className="vx-search__input" type="search" placeholder="Search movies and series" /><span className="vx-sr-only">Search</span></label>,
  "Title-bar search · focused with text": () => <label className="vx-search vx-search--titlebar" data-force="focus-within"><Search {...sw(2.2)} /><span className="vx-field__value">the<span className="vx-caret" /></span><button className="vx-search__clear" aria-label="Clear search"><X {...sw(2.6)} /></button><span className="vx-sr-only">Search</span></label>,

  "Toggle · on / off / disabled / focus": () => <>
    <button className="vx-switch" role="switch" aria-checked="true" aria-label="Toggle" />
    <button className="vx-switch" role="switch" aria-checked="false" aria-label="Toggle" />
    <button className="vx-switch" role="switch" aria-checked="true" aria-label="Toggle" disabled />
    <button className="vx-switch" role="switch" aria-checked="false" aria-label="Toggle" data-force="focus focus-visible" />
  </>,
  "Choice list · Current + hover": () => col(320, 2, <div className="vx-choice-list" role="radiogroup" aria-label="Playback engine">
    <button className="vx-choice" aria-current="true"><span className="vx-choice__label">Auto</span><Current /></button>
    <button className="vx-choice" data-force="hover"><span className="vx-choice__label">mpv</span></button>
    <button className="vx-choice"><span className="vx-choice__label">gstreamer</span></button>
  </div>),
  "Choice rows · focus / unavailable": () => col(320, 2, <div className="vx-choice-list">
    <button className="vx-choice" data-force="focus focus-visible"><span className="vx-choice__label">[English]</span></button>
    <button className="vx-choice" disabled><span className="vx-choice__label">[Japanese · TrueHD] (unavailable)</span></button>
  </div>),
  "Radio rows": () => col(320, 2, <div className="vx-choice-list" role="radiogroup" aria-label="Subtitle size">
    <button className="vx-choice" role="radio" aria-checked="false"><span className="vx-radio" aria-hidden="true" /><span className="vx-choice__label">Small</span></button>
    <button className="vx-choice" role="radio" aria-checked="true"><span className="vx-radio" aria-hidden="true" /><span className="vx-choice__label">System default</span><Current /></button>
    <button className="vx-choice" role="radio" aria-checked="false"><span className="vx-radio" aria-hidden="true" /><span className="vx-choice__label">Large</span></button>
  </div>),
});

/* ---------- TV ---------- */

const keys = "abcdefghijklmnopqrstuvwxyz1234567890:/.-_@".split("");

register("CmpTv1", {
  "Pill · default": () => <button className="vx-btn vx-btn--lead"><PlayIcon />Resume</button>,
  "Pill · focused": () => <button className="vx-btn vx-btn--lead" data-force="focus"><PlayIcon />Resume</button>,
  "Pill · pressed (OK held)": () => <button className="vx-btn vx-btn--lead" data-force="active"><PlayIcon />Resume</button>,
  "Pill · disabled": () => <button className="vx-btn vx-btn--lead" disabled><PlayIcon />Resume</button>,
  "Pill · loading": () => <button className="vx-btn vx-btn--lead" aria-busy="true"><span className="vx-spinner" aria-hidden="true" />Saving…</button>,
  "Icon pill 72 · default / focused": () => <>
    <button className="vx-btn vx-btn--icon" aria-label="Add to My List"><Plus {...sw(2.2)} /></button>
    <button className="vx-btn vx-btn--icon" aria-label="Add to My List" data-force="focus"><Plus {...sw(2.2)} /></button>
  </>,
  "Destructive · default / focused": () => <>
    <button className="vx-btn vx-btn--destructive vx-btn--lead"><Trash {...sw(2)} />Delete profile</button>
    <button className="vx-btn vx-btn--destructive vx-btn--lead" data-force="focus"><Trash {...sw(2)} />Delete profile</button>
  </>,
  "Source pill · default / focused": () => <>
    <button className="vx-source-pill"><span className="vx-badge vx-badge--quality">1080p</span>LordStreams</button>
    <button className="vx-source-pill" data-force="focus"><span className="vx-badge vx-badge--quality">1080p</span>LordStreams</button>
  </>,
  "Small pill 52 · season": () => <>
    <button className="vx-btn vx-btn--small">Season 1</button>
    <button className="vx-btn vx-btn--small" data-force="focus">Season 1</button>
  </>,
  "Text action · focused": () => <a href="#" className="vx-link" data-force="focus">Use without an account</a>,

  "Chip · default": () => <button className="vx-chip" aria-pressed="false"><span>Seasonal</span></button>,
  "Chip · selected": () => <button className="vx-chip" aria-pressed="true"><span>Popular</span></button>,
  "Chip · focused": () => <button className="vx-chip" aria-pressed="false" data-force="focus"><span>Seasonal</span></button>,
  "Quality chips · counts": () => <>
    <button className="vx-chip" aria-pressed="true"><span>All</span><span className="vx-chip__count">12</span></button>
    <button className="vx-chip" aria-pressed="false"><span>1080p</span><span className="vx-chip__count">5</span></button>
    <button className="vx-chip" aria-pressed="false" data-force="focus"><span>720p</span><span className="vx-chip__count">4</span></button>
  </>,
  "Filter chip · value / required": () => <>
    <button className="vx-chip vx-chip--dropdown" aria-haspopup="dialog"><span className="vx-chip__key">Genre:</span><span>Any</span><ChevronDown {...sw(2.2)} /></button>
    <button className="vx-chip vx-chip--dropdown" aria-haspopup="dialog"><span>Year</span><span className="vx-chip__tag">Required</span><ChevronDown {...sw(2.2)} /></button>
  </>,
  "Group divider": () => <>
    <button className="vx-chip" aria-pressed="true"><span>Movies</span></button>
    <span className="vx-chip-divider" aria-hidden="true" />
    <button className="vx-chip" aria-pressed="true"><span>Popular</span></button>
  </>,

  "Quality badge": () => <><span className="vx-badge vx-badge--quality">1080p</span><span className="vx-badge vx-badge--quality">720p</span></>,
  "LIVE": () => <span className="vx-badge vx-badge--live"><span className="vx-badge__dot" />LIVE</span>,
  "WATCHING": () => <span className="vx-badge vx-badge--watching">Watching</span>,
  "Best match": () => <span className="vx-eyebrow vx-eyebrow--accent">Best match</span>,
  "Progress 6 px": () => box(300, <span className="vx-progress" role="progressbar" aria-valuenow={58} aria-valuemin={0} aria-valuemax={100}><span className="vx-progress__fill" style={{ width: "58%" }} /></span>),
  "Live dot": () => <span className="vx-live-dot" aria-hidden="true" />,
  "Spinner 18": () => <span className="vx-spinner" aria-hidden="true" />,
  "Status words": () => <span style={{ display: "flex", gap: 36 }}>{["Playing", "Paused", "Buffering", "Loading"].map((word) => <span key={word} className="vx-status-word">{word}</span>)}</span>,

  "Search field · caret": () => box(560, <label className="vx-search" style={{ width: 560 }}><span className="vx-field__value">naruto<span className="vx-caret" /></span><span className="vx-sr-only">Search</span></label>),
  "Text entry field · empty / error": () => col(620, 18, <>
    <Field label="Profile name" placeholder="[Profile name]" srLabel />
    <Field label="Install addon manifest URL" value="http://[addon.example]" error srLabel message="Enter an HTTPS manifest URL." />
  </>),
  "On-screen keyboard": () => (
    <div className="vx-keyboard">
      <div className="vx-keyboard__keys">
        {keys.map((key) => <button key={key} className="vx-key" data-force={key === "t" ? "focus" : undefined}>{key}</button>)}
        <button className="vx-key vx-key--action" aria-label="Shift">Aa</button>
        <button className="vx-key vx-key--action vx-key--span-3" aria-label="Space"><Space {...sw(2)} /></button>
        <button className="vx-key vx-key--action vx-key--span-2" aria-label="Delete"><Delete {...sw(2)} /></button>
      </div>
      <div className="vx-keyboard__actions"><button className="vx-btn">Done</button><button className="vx-btn">Cancel</button></div>
    </div>
  ),
  "PIN keypad": () => (
    <div className="vx-keyboard vx-keypad">
      <div className="vx-keyboard__keys">
        {"123456789".split("").map((key) => <button key={key} className="vx-key" data-force={key === "5" ? "focus" : undefined}>{key}</button>)}
        <button className="vx-key" aria-label="Delete"><Delete {...sw(2)} /></button>
        <button className="vx-key">0</button>
        <span aria-hidden="true" />
      </div>
      <div className="vx-keyboard__actions"><button className="vx-btn">Done</button><button className="vx-btn">Cancel</button></div>
    </div>
  ),
  "PIN field · entering / error": () => col(600, 30, <>
    <Pin filled={3} active />
    <Pin filled={4} error message="Incorrect PIN. Try again." />
  </>),
  "Choice rows · focused current / default / unavailable / destructive": () => col(620, 14, <div className="vx-choice-list" role="radiogroup" aria-label="Subtitles">
    <button className="vx-choice" aria-current="true" data-force="focus"><span className="vx-choice__label"><span>[English]</span><span className="vx-choice__note">· Current</span></span></button>
    <button className="vx-choice"><span className="vx-choice__label"><span>Off</span></span></button>
    <button className="vx-choice" disabled><span className="vx-choice__label"><span>[Portuguese (PGS)]</span><span className="vx-choice__note">· unavailable</span></span></button>
    <button className="vx-choice vx-choice--destructive"><span className="vx-choice__label"><span>Remove addon</span></span></button>
  </div>),
});
