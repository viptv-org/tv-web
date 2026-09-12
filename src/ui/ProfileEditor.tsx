import { useEffect, useState } from "react";
import { TvApi, type TvProfile } from "../api";
import { TextEntry } from "./TextEntry";
import { TvButton, focusElement } from "./remote";
import catalog from "./avatars.json";
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
  useEffect(() => {
    focusElement(
      mode === "form"
        ? "profile-name"
        : mode === "avatar"
          ? "avatar-0"
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
      if (mode === "form") onCancel();
      else setMode("form");
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
          onCancel={() => setMode("form")}
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
            await api.unlockParent(pin);
            setMode("form");
            await save(pending === "delete");
          }}
          onCancel={() => setMode("form")}
        />
      </div>
    );
  return (
    <section
      className="profile-editor"
      data-focus-scope="profile-editor"
      onKeyDown={key}
    >
      <h1>{profile ? "Edit profile" : "Add a profile"}</h1>
      {mode === "avatar" ? (
        <>
          <h2>Choose your avatar</h2>
          <div className="avatar-categories">
            {catalog.categories.map((c) => (
              <TvButton
                key={c.style}
                id={`avatar-category-${c.style}`}
                onActivate={() => {
                  setPreviewStyle(c.style);
                  setPage(0);
                }}
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
              disabled={page === 0}
              onActivate={() => setPage((p) => p - 1)}
            >
              Previous
            </TvButton>
            <span>{page + 1} / 3</span>
            <TvButton
              id="avatar-next"
              disabled={page === 2}
              onActivate={() => setPage((p) => p + 1)}
            >
              Next
            </TvButton>
            <TvButton id="avatar-cancel" onActivate={() => setMode("form")}>
              Back
            </TvButton>
          </div>
        </>
      ) : mode === "delete" ? (
        <>
          <p>
            Delete {profile?.name}? This permanently removes this profile's
            watch history, favorites and preferences.
          </p>
          <TvButton id="delete-cancel" onActivate={() => setMode("form")}>
            Cancel
          </TvButton>
          <TvButton
            id="delete-confirm"
            disabled={busy}
            onActivate={() => void save(true)}
          >
            Delete profile
          </TvButton>
        </>
      ) : (
        <div className="profile-form">
          <TvButton
            id="profile-avatar"
            onActivate={() => {
              setPreviewStyle(style);
              setPage(Math.floor((choice - 1) / 18));
              setMode("avatar");
            }}
          >
            <img
              src={`${import.meta.env.BASE_URL}assets/avatar-catalog/${style}-${choice}.png`}
              alt="Choose avatar"
            />
          </TvButton>
          <TvButton id="profile-name" onActivate={() => setMode("name")}>
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
            <TvButton id="profile-cancel" onActivate={onCancel}>
              Cancel
            </TvButton>
            {profile && !primary && (
              <TvButton
                id="profile-delete"
                onActivate={() => setMode("delete")}
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
  );
}
