import { useEffect, useRef, useState } from "react";
import { TvApi, type TvProfile } from "../api";
import { TextEntry } from "./TextEntry";
import { DialogBackdrop } from "./DialogBackdrop";
import { TvButton, focusElement } from "./remote";
import catalog from "./avatars.json";
import "./account-roku.css";
export const avatarUrl = (profile: TvProfile) =>
  `${import.meta.env.BASE_URL}assets/avatar-catalog/${typeof profile.raw.avatar_style === "string" ? profile.raw.avatar_style : "critters"}-${typeof profile.raw.avatar_choice === "number" ? profile.raw.avatar_choice : 1}.png`;
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
    [busy, setBusy] = useState(false),
    [pending, setPending] = useState<"save" | "delete">("save");
  const [opener] = useState(() => document.activeElement as HTMLElement | null);
  const parentScope = useRef<ReturnType<TvApi["createScope"]>>();
  const returnFocus = useRef("profile-name");
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
    focusElement(
      mode === "form"
        ? returnFocus.current
        : mode === "avatar"
          ? `avatar-category-${previewStyle}`
          : mode === "delete"
            ? "delete-cancel"
            : "text-key-0",
    );
  }, [mode]);
  const save = async (remove = false) => {
    setBusy(true);
    setError("");
    try {
      if (remove) {
        if (!profile || primary) return;
        await api.deleteProfile(profile.id);
      } else {
        if (!name.trim()) throw new Error("Enter a name to continue.");
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
  const key = (e: React.KeyboardEvent) => {
    if (
      e.key === "Escape" ||
      e.key === "BrowserBack" ||
      e.keyCode === 10009 ||
      e.keyCode === 461
    ) {
      e.preventDefault();
      e.stopPropagation();
      cancel();
    }
  };
  if (mode === "name")
    return (
      <div onKeyDown={key}>
        <TextEntry
          title="Profile name"
          initialValue={name}
          onSubmit={async (value) => {
            setName(value);
            setMode("form");
          }}
          onCancel={cancel}
        />
      </div>
    );
  if (mode === "pin")
    return (
      <div onKeyDown={key}>
        <TextEntry
          title="Parent PIN"
          secret
          onSubmit={async (pin) => {
            if (!/^\d{4,8}$/.test(pin))
              throw new Error("Enter a 4–8 digit PIN.");
            parentScope.current?.abort();
            const scope = api.createScope();
            parentScope.current = scope;
            try {
              await api.unlockParent(pin, { signal: scope.signal });
            } catch (error) {
              if (scope.signal.aborted) return;
              throw error;
            }
            if (scope.signal.aborted) return;
            setMode("form");
            await save(pending === "delete");
          }}
          onCancel={cancel}
        />
      </div>
    );
  return (
    <DialogBackdrop onCancel={cancel}>
    <section
      className={`profile-editor roku-profile-editor mode-${mode}`}
      data-focus-scope="profile-editor"
      role="dialog"
      aria-modal="true"
      aria-label={mode === "avatar" ? "Find your favorite" : mode === "delete" ? "Delete profile" : profile ? "Edit profile" : "Add a profile"}
      onKeyDown={key}
    >
      <img
        className="account-mark"
        src={`${import.meta.env.BASE_URL}assets/viptv-mark.png`}
        alt="VIPTV"
      />
      <h1>
        {mode === "avatar"
          ? "Find your favorite"
          : mode === "delete"
            ? "Delete profile"
            : profile
              ? "Edit profile"
              : "Add a profile"}
      </h1>
      {mode === "avatar" ? (
        <>
          <p className="picker-hint">
            624 avatars. Pick a world, then pick your character.
          </p>
          <div className="avatar-categories">
            {catalog.categories.map((c) => (
              <TvButton
                key={c.style}
                id={`avatar-category-${c.style}`}
                onFocus={() => {
                  setPreviewStyle(c.style);
                  setPage(0);
                }}
                onActivate={() => focusElement("avatar-0")}
              >
                {c.name}
              </TvButton>
            ))}
          </div>
          <div className="avatar-grid">
            {Array.from(
              { length: Math.min(18, 48 - page * 18) },
              (_, i) => page * 18 + i + 1,
            ).map((n, i) => (
              <TvButton
                id={`avatar-${i}`}
                key={n}
                onActivate={() => {
                  setStyle(previewStyle);
                  setChoice(n);
                  setMode("form");
                }}
              >
                <img
                  src={`${import.meta.env.BASE_URL}assets/avatar-catalog/${previewStyle}-${n}.png`}
                  alt={`${previewStyle} ${n}`}
                />
              </TvButton>
            ))}
          </div>
          <div className="avatar-pager">
            <TvButton
              id="avatar-previous"
              onActivate={() => {
                setPage((p) => (p + 2) % 3);
                setTimeout(() => focusElement("avatar-0"), 0);
              }}
            >
              Previous
            </TvButton>

            <TvButton
              id="avatar-next"
              onActivate={() => {
                setPage((p) => (p + 1) % 3);
                setTimeout(() => focusElement("avatar-0"), 0);
              }}
            >
              Next
            </TvButton>
          </div>
          <p className="avatar-page-label">
            {catalog.categories.find((c) => c.style === previewStyle)?.name} ·{" "}
            {page + 1} / 3
          </p>
        </>
      ) : mode === "delete" ? (
        <div className="profile-delete-confirmation">
          <p>
            Delete {profile?.name}? This permanently removes this profile's
            watch history, favorites and preferences.
          </p>
          <TvButton id="delete-cancel" onActivate={cancel}>
            Cancel
          </TvButton>
          <TvButton
            id="delete-confirm"
            disabled={busy}
            onActivate={() => void save(true)}
          >
            Delete profile
          </TvButton>
        </div>
      ) : (
        <div className="profile-form">
          <p className="profile-introduction">
            A space for their favorites, shows, and discoveries.
          </p>
          <p className="profile-avatar-label">Change avatar</p>
          <p className="profile-name-label">PROFILE NAME</p>
          <p className="profile-input-help">
            Select to type with your remote or a connected keyboard.
          </p>
          <TvButton
            id="profile-avatar"
            onActivate={() => {
              returnFocus.current = "profile-avatar";
              setPreviewStyle(style);
              setPage(Math.floor((choice - 1) / 18));
              setMode("avatar");
            }}
          >
            <img
              src={`${import.meta.env.BASE_URL}assets/avatar-catalog/${style}-${choice}.png`}
              alt="Change avatar"
            />
          </TvButton>
          <TvButton id="profile-name" onActivate={() => { returnFocus.current = "profile-name"; setMode("name"); }}>
            {name || "Enter profile name"}
          </TvButton>
          <div className="actions">
            <TvButton
              id="profile-save"
              disabled={busy}
              onActivate={() => void save()}
            >
              {profile ? "Save" : "Create profile"}
            </TvButton>
            <TvButton id="profile-cancel" onActivate={cancel}>
              Cancel
            </TvButton>
            {profile && !primary && (
              <TvButton
                id="profile-delete"
                onActivate={() => { returnFocus.current = "profile-delete"; setMode("delete"); }}
              >
                Delete profile
              </TvButton>
            )}
          </div>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {busy && <p role="status">Saving profile…</p>}
    </section>
    </DialogBackdrop>
  );
}
