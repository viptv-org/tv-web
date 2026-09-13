import { useEffect, useState } from "react";
import { TvButton, focusElement } from "./remote";
import "./account-roku.css";
export function TextEntry({
  title,
  initialValue = "",
  secret = false,
  onSubmit,
  onCancel,
}: {
  title: string;
  initialValue?: string;
  secret?: boolean;
  onSubmit: (value: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialValue),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [lower, setLower] = useState(true);
  const limit = secret ? 8 : title === "Profile name" ? 64 : 2048;
  const append = (text: string) => setValue((v) => (v + text).slice(0, limit));
  useEffect(() => {
    const input = document.querySelector<HTMLInputElement>(".responsive-app .roku-text-entry input");
    if (input) input.focus();
    else focusElement("text-key-0");
  }, []);
  const save = async () => {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await onSubmit(value);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save");
    } finally {
      setPending(false);
    }
  };
  const keys = secret
    ? "1234567890"
    : `${lower ? "abcdefghijklmnopqrstuvwxyz" : "ABCDEFGHIJKLMNOPQRSTUVWXYZ"}1234567890:/.-_@`;
  return (
    <div
      className="text-entry roku-text-entry"
      data-focus-scope="entry"
      onKeyDown={(event) => {
        if (
          ["Escape", "BrowserBack"].includes(event.key) ||
          event.keyCode === 10009 ||
          event.keyCode === 461
        ) {
          event.preventDefault();
          event.stopPropagation();
          onCancel();
          return;
        }
        if (event.target instanceof HTMLInputElement) {
          if (event.key === "Enter") {
            event.preventDefault();
            event.stopPropagation();
            void save();
          }
          return;
        }
        if (event.key === "Backspace" || event.key === "Delete") {
          event.preventDefault();
          event.stopPropagation();
          setValue((v) => v.slice(0, -1));
        } else if (
          event.key.length === 1 &&
          !event.ctrlKey &&
          !event.metaKey &&
          (!secret || /^\d$/.test(event.key))
        ) {
          event.preventDefault();
          event.stopPropagation();
          append(event.key);
        }
      }}
    >
      <img
        className="account-mark"
        src={`${import.meta.env.BASE_URL}assets/viptv-mark.png`}
        alt="VIPTV"
      />
      <h1>{title}</h1>
      <p className="entry-instruction">
        Use your remote or a connected keyboard.
      </p>
      <input
        aria-label={title}
        type={secret ? "password" : "text"}
        value={value}
        onChange={(event) => setValue(event.target.value.slice(0, limit))}
        autoComplete="off"
        maxLength={limit}
      />
      <div className={`entry-keys ${secret ? "pin-keys" : ""}`}>
        {keys.split("").map((c, index) => (
          <TvButton
            id={`text-key-${index}`}
            key={index}
            onActivate={() => append(c)}
          >
            {c}
          </TvButton>
        ))}
        {!secret && (
          <>
            <TvButton id="text-case" onActivate={() => setLower(!lower)}>
              Aa
            </TvButton>
            <TvButton id="text-space" onActivate={() => append(" ")}>
              Space
            </TvButton>
          </>
        )}
        <TvButton
          id="text-delete"
          onActivate={() => setValue((v) => v.slice(0, -1))}
          onHold={() => setValue("")}
        >
          Delete
        </TvButton>
      </div>
      <div className="actions">
        <TvButton
          id="text-save"
          disabled={pending}
          onActivate={() => void save()}
        >
          {pending ? "Saving…" : "Done"}
        </TvButton>
        <TvButton id="text-cancel" onActivate={onCancel}>
          Cancel
        </TvButton>
      </div>
      {error && (
        <p className="entry-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
