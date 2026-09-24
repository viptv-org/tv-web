import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronLeft, ChevronRight, CircleAlert, Pencil, Trash2, X } from "lucide-react";
import { TvApi, type TvProfile } from "../api";
import { TextEntry, isTvLayout } from "./TextEntry";
import { DialogBackdrop } from "./DialogBackdrop";
import { TvButton, focusElement } from "./remote";
import { buttonClass } from "./primitives/Button";
import { AvatarTileContent } from "./primitives/Cards";
import { KeyLegend } from "./primitives/Keys";
import catalog from "./avatars.json";

/* ---- Avatar catalog -------------------------------------------------------
 * Categories marked "available": false (the Disney-style worlds) have no
 * images in public/assets/avatar-catalog, so the picker hides them and the
 * "[N] avatars" count covers only the worlds it shows. */
export const avatarWorlds = catalog.categories.filter((category) => !("available" in category) || category.available !== false);
export const avatarCount = avatarWorlds.length * catalog.perCategory;
const PAGE_SIZE = 18;
const pageCount = Math.ceil(catalog.perCategory / PAGE_SIZE);
const avatarSrc = (style: string, choice: number) => `${import.meta.env.BASE_URL}assets/avatar-catalog/${style}-${choice}.png`;
const worldName = (style: string) => catalog.categories.find((category) => category.style === style)?.name ?? style;

export const avatarUrl = (profile: TvProfile) =>
  avatarSrc(
    typeof profile.raw.avatar_style === "string" ? profile.raw.avatar_style : "critters",
    typeof profile.raw.avatar_choice === "number" ? profile.raw.avatar_choice : 1,
  );

/**
 * Protected profiles show a lock badge (decisions.md 4). The profile DTO has no
 * PIN flag today, so this reads the raw fields a backend could send; it is
 * false for every profile until one does.
 */
export const profileLocked = (profile: TvProfile) =>
  ["pin_protected", "pin_required", "requires_pin", "protected", "locked"].some((key) => profile.raw[key] === true);

/** A profile picture, or its initial on the letter ground when the image is missing. */
export function ProfileAvatar({ profile }: { profile: TvProfile }) {
  const src = avatarUrl(profile);
  const [failed, setFailed] = useState<string>();
  return failed === src ? (
    <span className="vx-profile__letter vx-account-letter" aria-hidden="true">
      {profile.name.trim().slice(0, 1).toUpperCase()}
    </span>
  ) : (
    <img alt="" src={src} decoding="async" onError={() => setFailed(src)} />
  );
}

const isBackKey = (event: KeyboardEvent) =>
  event.key === "Escape" || event.key === "BrowserBack" || event.keyCode === 10009 || event.keyCode === 461;

/**
 * Add / edit a profile: a full page on every platform (PhProfileEdit, DeskProfileEdit,
 * TvProfileEdit) that switches to the avatar picker (Ph/Desk/TvAvatars). The name entry,
 * the parent PIN and the delete confirmation open over it (sheet / dialog / TV panel).
 */
export function ProfileEditor({
  api,
  profile,
  primary,
  onDone,
  onCancel,
}: {
  api: TvApi;
  profile?: TvProfile;
  primary: boolean;
  onDone: () => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(profile?.name ?? ""),
    [style, setStyle] = useState(
      typeof profile?.raw.avatar_style === "string"
        ? profile.raw.avatar_style
        : "critters",
    ),
    [previewStyle, setPreviewStyle] = useState(style),
    [choice, setChoice] = useState(
      typeof profile?.raw.avatar_choice === "number"
        ? profile.raw.avatar_choice
        : 1,
    ),
    [mode, setMode] = useState<"form" | "name" | "avatar" | "pin" | "delete">(
      "form",
    ),
    [page, setPage] = useState(0),
    [error, setError] = useState(""),
    [nameMissing, setNameMissing] = useState(false),
    [busy, setBusy] = useState(false),
    [pending, setPending] = useState<"save" | "delete">("save");
  const [tv] = useState(isTvLayout);
  const [opener] = useState(() => document.activeElement as HTMLElement | null);
  const parentScope = useRef<ReturnType<TvApi["createScope"]>>();
  const returnFocus = useRef("profile-name");
  const worlds = useRef<HTMLDivElement>(null);
  useEffect(() => () => {
    parentScope.current?.abort();
    setTimeout(() => { if (opener?.isConnected) opener.focus(); }, 0);
  }, [opener]);
  const cancel = () => {
    parentScope.current?.abort();
    parentScope.current = undefined;
    if (mode === "form") onCancel();
    else setMode("form");
  };
  useEffect(() => {
    if (mode === "form") focusElement(returnFocus.current);
    else if (mode === "avatar") {
      // Phone / desktop: keep the chosen world in view (the rail scrolls sideways).
      if (!tv) worlds.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView?.({ block: "nearest", inline: "center" });
      focusElement(`avatar-category-${previewStyle}`);
    } else if (mode === "delete") focusElement("delete-cancel");
  }, [mode]);
  const save = async (remove = false) => {
    // Busy buttons stay focusable (a disabled focused button drops TV focus); ignore repeats.
    if (busy) return;
    if (!remove && !name.trim()) {
      setNameMissing(true);
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (remove) {
        if (!profile || primary) return;
        await api.deleteProfile(profile.id);
      } else {
        const value = {
          name: name.trim(),
          avatar_style: style,
          avatar_choice: choice,
        };
        if (profile)
          await api.updateProfile(profile.id, {
            ...value,
            ...(!profile.setupComplete ? { setup_complete: true } : {}),
          });
        else await api.createProfile(value);
      }
      await onDone();
    } catch (e) {
      if ((e as { status?: number }).status === 403) {
        setPending(remove ? "delete" : "save");
        returnFocus.current = remove ? "profile-delete" : "profile-save";
        setMode("pin");
      } else
        setError(
          e instanceof Error
            ? e.message
            : "Could not save your profile. Please try again.",
        );
    } finally {
      setBusy(false);
    }
  };
  const key = (e: KeyboardEvent) => {
    if (isBackKey(e)) {
      e.preventDefault();
      e.stopPropagation();
      cancel();
    }
  };
  const pickWorld = (world: string) => {
    if (world !== previewStyle) {
      setPreviewStyle(world);
      setPage(0);
    }
  };
  const turnPage = (step: number) => {
    setPage((current) => (current + step + pageCount) % pageCount);
    if (tv) setTimeout(() => focusElement("avatar-0"), 0);
  };
  const overlay = mode === "name" || mode === "pin" || mode === "delete";
  const title = mode === "avatar"
    ? "Find your favorite"
    : profile
      ? "Edit profile"
      : "Add a profile";
  const deletable = !!profile && !primary;

  const picker = (
    <>
      <div className="vx-avatars__head">
        {!tv && (
          <button type="button" className="vx-avatars__back" aria-label="Back" onClick={cancel}>
            <ChevronLeft aria-hidden="true" />
          </button>
        )}
        <h1 className="vx-account-editor__title">Find your favorite</h1>
      </div>
      <p className="vx-avatars__count">
        {avatarCount} avatars. Pick a world, then pick your character.
      </p>
      <div className="vx-avatars__worlds" ref={worlds} role="group" aria-label="Avatar worlds">
        {avatarWorlds.map((world) => (
          <TvButton
            key={world.style}
            id={`avatar-category-${world.style}`}
            className="vx-chip"
            aria-pressed={world.style === previewStyle}
            onFocus={() => { if (tv) pickWorld(world.style); }}
            onActivate={() => {
              pickWorld(world.style);
              if (tv) focusElement("avatar-0");
            }}
          >
            <span>{world.name}</span>
          </TvButton>
        ))}
      </div>
      <div className="vx-avatars__grid">
        {Array.from(
          { length: Math.min(PAGE_SIZE, catalog.perCategory - page * PAGE_SIZE) },
          (_, i) => page * PAGE_SIZE + i + 1,
        ).map((n, i) => {
          const selected = style === previewStyle && choice === n;
          return (
            <TvButton
              id={`avatar-${i}`}
              key={`${previewStyle}-${n}`}
              className="vx-avatar-tile"
              aria-label={`${worldName(previewStyle)} ${n}`}
              aria-pressed={selected}
              onActivate={() => {
                setStyle(previewStyle);
                setChoice(n);
                setMode("form");
              }}
            >
              <AvatarTileContent src={avatarSrc(previewStyle, n)} selected={selected} checkIcon={<Check aria-hidden="true" strokeWidth={3} />} />
            </TvButton>
          );
        })}
      </div>
      <div className="vx-avatars__pager">
        <TvButton id="avatar-previous" className={buttonClass({ size: "small", icon: true })} onActivate={() => turnPage(-1)}>
          <ChevronLeft aria-hidden="true" />
          Previous
        </TvButton>
        <span className="vx-avatars__page" aria-label={`${worldName(previewStyle)}, page ${page + 1} of ${pageCount}`}>
          <span className="vx-avatars__page-world">{worldName(previewStyle)} · </span>
          {page + 1} / {pageCount}
        </span>
        <TvButton id="avatar-next" className={buttonClass({ size: "small", icon: true })} onActivate={() => turnPage(1)}>
          <ChevronRight aria-hidden="true" />
          Next
        </TvButton>
      </div>
    </>
  );

  const form = (
    <>
      <div className="vx-account-editor__head">
        <h1 className="vx-account-editor__title">{title}</h1>
        <p className="vx-account-editor__intro">
          A space for their favorites, shows, and discoveries.
        </p>
      </div>
      <div className="vx-account-editor__body">
        <TvButton
          id="profile-avatar"
          className="vx-account-editor__avatar"
          aria-label="Change avatar"
          onActivate={() => {
            returnFocus.current = "profile-avatar";
            setPreviewStyle(style);
            setPage(Math.floor((choice - 1) / PAGE_SIZE));
            setMode("avatar");
          }}
        >
          <span className="vx-account-editor__avatar-art">
            <img src={avatarSrc(style, choice)} alt="" />
          </span>
          <span className="vx-account-editor__avatar-label">Change avatar</span>
        </TvButton>
        <div className="vx-account-editor__fields">
          <span className="vx-account-editor__label">Profile name</span>
          <TvButton
            id="profile-name"
            className={`vx-account-name${nameMissing && !name.trim() ? " vx-account-name--error" : ""}`}
            aria-label={`Profile name: ${name || "empty"}`}
            onActivate={() => { returnFocus.current = "profile-name"; setMode("name"); }}
          >
            {name
              ? <span className="vx-account-name__value">{name}</span>
              : <span className="vx-account-name__placeholder">Enter profile name</span>}
            <Pencil aria-hidden="true" />
          </TvButton>
          {nameMissing && !name.trim() && (
            <span className="vx-inline-error" role="alert">
              <CircleAlert aria-hidden="true" />
              Enter a name to continue.
            </span>
          )}
          {tv && (
            <span className="vx-account-editor__help">
              Select to type with your remote or a connected keyboard.
            </span>
          )}
          <div className={`vx-account-editor__actions${deletable ? " vx-account-editor__actions--delete" : ""}`}>
            <TvButton
              id="profile-save"
              className={buttonClass({ kind: "primary", icon: busy })}
              aria-busy={busy || undefined}
              onActivate={() => void save()}
            >
              {busy && <span className="vx-spinner" aria-hidden="true" />}
              {busy ? "Saving profile…" : profile ? "Save" : "Create profile"}
            </TvButton>
            <TvButton id="profile-cancel" className={buttonClass({})} onActivate={cancel}>
              Cancel
            </TvButton>
            {deletable && (
              <TvButton
                id="profile-delete"
                className={buttonClass({ kind: "destructive", icon: true })}
                onActivate={() => { returnFocus.current = "profile-delete"; setMode("delete"); }}
              >
                <Trash2 aria-hidden="true" />
                Delete profile
              </TvButton>
            )}
          </div>
          {error && (
            <span className="vx-inline-error" role="alert">
              <CircleAlert aria-hidden="true" />
              {error}
            </span>
          )}
          {busy && <span className="vx-sr-only" role="status">Saving profile…</span>}
        </div>
      </div>
    </>
  );

  return (
    <>
      <DialogBackdrop onCancel={cancel} scrim="clear" className="vx-account-page">
        <section
          className={`vx-account-editor${mode === "avatar" ? " vx-account-editor--avatars" : ""}${deletable ? " vx-account-editor--deletable" : ""}`}
          data-focus-scope="profile-editor"
          role="dialog"
          aria-modal="true"
          aria-label={title}
          aria-hidden={overlay || undefined}
          onKeyDown={key}
        >
          {mode === "avatar" ? picker : form}
        </section>
        {tv && !overlay && (
          <KeyLegend
            corner
            items={mode === "avatar"
              ? [{ key: "OK", label: "Choose" }, { key: "▲ ▼", label: "Worlds / grid" }, { key: "BACK", label: "Cancel" }]
              : [{ key: "OK", label: "Select" }, { key: "BACK", label: "Cancel" }]}
          />
        )}
      </DialogBackdrop>
      {mode === "name" && (
        <div onKeyDown={key}>
          <TextEntry
            title="Profile name"
            initialValue={name}
            maxLength={64}
            showCount
            hint="Select to type with your remote or a connected keyboard."
            onSubmit={async (value) => {
              setName(value);
              setMode("form");
            }}
            onCancel={cancel}
          />
        </div>
      )}
      {mode === "pin" && (
        <div onKeyDown={key}>
          <TextEntry
            title="Enter parent PIN"
            secret
            onSubmit={async (pin) => {
              if (!/^\d{4,8}$/.test(pin))
                throw new Error("Enter a 4–8 digit parent PIN");
              parentScope.current?.abort();
              const scope = api.createScope();
              parentScope.current = scope;
              try {
                await api.unlockParent(pin, { signal: scope.signal });
              } catch (error) {
                if (scope.signal.aborted) return;
                const status = (error as { status?: number }).status;
                throw status === 403 ? new Error("Incorrect PIN. Try again.") : error;
              }
              if (scope.signal.aborted) return;
              setMode("form");
              await save(pending === "delete");
            }}
            onCancel={cancel}
          />
        </div>
      )}
      {mode === "delete" && (
        <DialogBackdrop onCancel={cancel} className="vx-entry-layer">
          <section
            className="vx-dialog vx-account-delete"
            role="dialog"
            aria-modal="true"
            aria-label="Delete profile"
            data-focus-scope="profile-delete"
            onKeyDown={key}
          >
            <button type="button" className="vx-dialog__grabber" aria-label="Close" onClick={cancel}><span /></button>
            <div className="vx-dialog__header">
              <h2 className="vx-dialog__title">Delete profile</h2>
              <button type="button" className="vx-close" aria-label="Close" onClick={cancel}>
                <X aria-hidden="true" strokeWidth={2.2} />
              </button>
            </div>
            <p className="vx-dialog__text">
              Delete {profile?.name}? This permanently removes this profile's
              watch history, favorites and preferences.
            </p>
            {error && (
              <span className="vx-inline-error" role="alert">
                <CircleAlert aria-hidden="true" />
                {error}
              </span>
            )}
            <div className="vx-dialog__actions">
              <TvButton id="delete-cancel" className={buttonClass({ block: true })} onActivate={cancel}>
                Cancel
              </TvButton>
              <TvButton
                id="delete-confirm"
                className={buttonClass({ kind: "destructive", block: true, icon: true })}
                aria-busy={busy || undefined}
                onActivate={() => void save(true)}
              >
                {busy ? <span className="vx-spinner" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
                Delete profile
              </TvButton>
            </div>
          </section>
          {tv && <KeyLegend corner items={[{ key: "OK", label: "Select" }, { key: "BACK", label: "Cancel" }]} />}
        </DialogBackdrop>
      )}
    </>
  );
}
