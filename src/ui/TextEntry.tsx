import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { CircleAlert, Delete, Space, X } from "lucide-react";
import { TvButton, focusElement } from "./remote";
import { DialogBackdrop } from "./DialogBackdrop";
import { buttonClass } from "./primitives/Button";
import { FieldValue, PinBoxes } from "./primitives/Fields";
import { KeyLegend } from "./primitives/Keys";

/** The TV layout (remote, on-screen keyboard). Unset (unit tests) reads as TV, like RemoteRoot. */
export const isTvLayout = () =>
  typeof document === "undefined" || document.documentElement.dataset.layout !== "responsive";

const isBack = (event: KeyboardEvent) =>
  ["Escape", "BrowserBack"].includes(event.key) || event.keyCode === 10009 || event.keyCode === 461;
const consume = (event: KeyboardEvent) => {
  event.preventDefault();
  event.stopPropagation();
};

/**
 * Text entry for every flow that asks for one value (profile name, parent PIN,
 * addon URL, catalog filter, Live TV search).
 *   phone    bottom sheet: title, field (or PIN boxes), count / inline error, Done + Cancel
 *   desktop  centred 460 dialog with the × close disc (Esc)
 *   TV       text: full screen, field left, keyboard right (BACK deletes, ▶▶ is Done);
 *            PIN (secret): right panel with the PIN keypad (BACK cancels)
 * Screens: PhProfileName, TvProfileName, PhPin, DeskPin, TvPin, TvPinError, PhFilterText,
 * TvFilterText, PhAddonInstall, DeskAddonInstall, TvAddonInstall.
 */
export function TextEntry({
  title,
  initialValue = "",
  secret = false,
  onSubmit,
  onCancel,
  maxLength,
  showCount = false,
  hint,
  mono,
  description,
}: {
  title: string;
  initialValue?: string;
  /** Parent PIN: digits only, 4–8, drawn as boxes. */
  secret?: boolean;
  onSubmit: (value: string) => Promise<void>;
  onCancel: () => void;
  maxLength?: number;
  /** "5 / 64" under the field. */
  showCount?: boolean;
  /** TV helper line under the field ("Select to type with your remote…"). */
  hint?: ReactNode;
  /** Monospace value (addon manifest URL); defaults to titles that name a URL. */
  mono?: boolean;
  /** PIN copy under the title; defaults per platform (copy.md). */
  description?: string;
}) {
  const [value, setValue] = useState(initialValue),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [lower, setLower] = useState(true),
    [inputFocused, setInputFocused] = useState(false);
  const [tv] = useState(isTvLayout);
  const input = useRef<HTMLInputElement>(null);
  const limit = maxLength ?? (secret ? 8 : 2048);
  const monospace = mono ?? /\burl\b/i.test(title);
  const update = (next: string) => {
    setValue((secret ? next.replace(/\D/g, "") : next).slice(0, limit));
    setError("");
  };
  const append = (text: string) => update(value + text);
  const removeLast = () => update(value.slice(0, -1));
  useEffect(() => {
    if (tv) focusElement("text-key-0");
    else input.current?.focus();
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
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (isBack(event)) {
      consume(event);
      // TV text entry: BACK deletes (legend "BACK Delete"); an empty field closes.
      if (tv && !secret && value && event.key !== "Escape") removeLast();
      else onCancel();
      return;
    }
    if (tv && !secret && (event.key === "MediaFastForward" || event.keyCode === 417)) {
      consume(event);
      void save();
      return;
    }
    if (event.target instanceof HTMLInputElement) {
      if (event.key === "Enter") {
        consume(event);
        void save();
      }
      return;
    }
    if (event.key === "Backspace" || event.key === "Delete") {
      consume(event);
      removeLast();
    } else if (
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      (!secret || /^\d$/.test(event.key))
    ) {
      consume(event);
      append(event.key);
    }
  };

  const errorLine = error ? (
    <span className="vx-inline-error" role="alert">
      <CircleAlert aria-hidden="true" />
      {error}
    </span>
  ) : null;
  const doneLabel = pending ? "Saving…" : "Done";
  // The real input: typed into on phone / desktop (and by a connected keyboard or
  // automation on TV, where it lies transparent over the drawn field).
  const field = (
    <input
      ref={input}
      className={secret ? "vx-entry__pin-input" : tv ? "vx-entry__tv-input" : "vx-field__input"}
      aria-label={title}
      aria-invalid={error ? true : undefined}
      type={secret ? "password" : "text"}
      inputMode={secret ? "numeric" : undefined}
      value={value}
      placeholder={secret || tv ? undefined : title}
      onChange={(event) => update(event.target.value)}
      onFocus={() => setInputFocused(true)}
      onBlur={() => setInputFocused(false)}
      autoComplete="off"
      autoCapitalize={monospace ? "none" : undefined}
      spellCheck={false}
      maxLength={limit}
      tabIndex={tv ? -1 : undefined}
    />
  );
  const pin = secret ? (
    <div className="vx-entry__pin">
      <PinBoxes
        length={Math.min(8, Math.max(6, value.length + 1))}
        filled={value.length}
        active={!error && (tv || inputFocused) && value.length < limit}
        error={!!error}
        label={`Parent PIN, ${value.length} of 4 to 8 digits entered`}
      />
      {field}
    </div>
  ) : null;
  const count = showCount && !secret ? <span className="vx-entry__count">{value.length} / {limit}</span> : null;

  if (!tv)
    return (
      <DialogBackdrop onCancel={onCancel} className="vx-entry-layer">
        <section
          className={`vx-dialog vx-entry${secret ? " vx-entry--pin" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-label={secret ? "Authorization" : "Text entry"}
          data-focus-scope="entry"
          onKeyDown={onKeyDown}
        >
          <button type="button" className="vx-dialog__grabber" aria-label="Close" onClick={onCancel}><span /></button>
          <div className="vx-dialog__header">
            <h2 className="vx-dialog__title">{title}</h2>
            <button type="button" className="vx-close" aria-label="Close" onClick={onCancel}>
              <X aria-hidden="true" strokeWidth={2.2} />
            </button>
          </div>
          {secret ? (
            <>
              <p className="vx-dialog__text">{description ?? "Enter the parent PIN to continue."}</p>
              {pin}
            </>
          ) : (
            <label className={`vx-field${error ? " vx-field--error" : ""}${monospace ? " vx-field--mono" : ""}`}>
              <span className="vx-sr-only">{title}</span>
              <span className="vx-field__control">{field}</span>
            </label>
          )}
          {count}
          {errorLine}
          <div className="vx-dialog__actions">
            <TvButton
              id="text-save"
              type="button"
              className={buttonClass({ kind: "primary", block: true, icon: pending })}
              aria-busy={pending || undefined}
             
              onActivate={() => void save()}
            >
              {pending && <span className="vx-spinner" aria-hidden="true" />}
              {doneLabel}
            </TvButton>
            <TvButton id="text-cancel" type="button" className={buttonClass({ block: true })} onActivate={onCancel}>
              Cancel
            </TvButton>
          </div>
        </section>
      </DialogBackdrop>
    );

  const actions = (
    <div className="vx-keyboard__actions">
      <TvButton id="text-save" className={buttonClass({})} aria-busy={pending || undefined} onActivate={() => void save()}>
        {doneLabel}
      </TvButton>
      <TvButton id="text-cancel" className={buttonClass({})} onActivate={onCancel}>
        Cancel
      </TvButton>
    </div>
  );

  if (secret)
    return (
      <DialogBackdrop onCancel={onCancel} className="vx-entry-layer">
        <section
          className="vx-dialog vx-entry vx-entry--pin"
          role="dialog"
          aria-modal="true"
          aria-label="Authorization"
          data-focus-scope="entry"
          onKeyDown={onKeyDown}
        >
          <div className="vx-dialog__header">
            <h2 className="vx-dialog__title">{title}</h2>
          </div>
          <p className="vx-dialog__text">{description ?? "Use your remote or a connected keyboard."}</p>
          <div className="vx-entry__pin-block">
            {pin}
            {errorLine}
          </div>
          <div className="vx-keyboard vx-keypad">
            <div className="vx-keyboard__keys">
              {"123456789".split("").map((digit, index) => (
                <TvButton id={`text-key-${index}`} key={digit} className="vx-key" onActivate={() => append(digit)}>
                  {digit}
                </TvButton>
              ))}
              <TvButton id="text-delete" className="vx-key" aria-label="Delete" onActivate={removeLast} onHold={() => update("")}>
                <Delete aria-hidden="true" />
              </TvButton>
              <TvButton id="text-key-9" className="vx-key" onActivate={() => append("0")}>
                0
              </TvButton>
              <span aria-hidden="true" />
            </div>
            {actions}
          </div>
        </section>
        <KeyLegend corner items={[{ key: "OK", label: "Select" }, { key: "BACK", label: "Cancel" }]} />
      </DialogBackdrop>
    );

  const keys = `${lower ? "abcdefghijklmnopqrstuvwxyz" : "ABCDEFGHIJKLMNOPQRSTUVWXYZ"}1234567890:/.-_@`;
  return (
    <DialogBackdrop onCancel={onCancel} className="vx-entry-layer vx-entry-layer--full">
      <section className="vx-tv-entry vx-entry" role="dialog" aria-modal="true" aria-label="Text entry" data-focus-scope="entry" onKeyDown={onKeyDown}>
        <div className="vx-tv-entry__main">
          <h2 className="vx-tv-entry__title">{title}</h2>
          <label className={`vx-field${error ? " vx-field--error" : ""}${monospace ? " vx-field--mono" : ""}`}>
            <span className="vx-sr-only">{title}</span>
            <span className="vx-field__control">
              <FieldValue value={secret ? "" : value} placeholder={title} caret />
              {field}
            </span>
          </label>
          {errorLine || hint || count ? (
            <div className="vx-tv-entry__hints">
              {errorLine ?? <span>{hint}</span>}
              {count && <span className="vx-tv-entry__count">{value.length} / {limit}</span>}
            </div>
          ) : null}
        </div>
        <div className="vx-tv-entry__keys">
          <div className="vx-keyboard">
            <div className="vx-keyboard__keys">
              {keys.split("").map((c, index) => (
                <TvButton id={`text-key-${index}`} key={index} className="vx-key" onActivate={() => append(c)}>
                  {c}
                </TvButton>
              ))}
              <TvButton id="text-case" className="vx-key vx-key--action" aria-label="Shift" aria-pressed={!lower} onActivate={() => setLower(!lower)}>
                Aa
              </TvButton>
              <TvButton id="text-space" className="vx-key vx-key--action vx-key--span-3" aria-label="Space" onActivate={() => append(" ")}>
                <Space aria-hidden="true" />
              </TvButton>
              <TvButton id="text-delete" className="vx-key vx-key--action vx-key--span-2" aria-label="Delete" onActivate={removeLast} onHold={() => update("")}>
                <Delete aria-hidden="true" />
              </TvButton>
            </div>
            {actions}
          </div>
        </div>
      </section>
      <KeyLegend corner items={[{ key: "OK", label: "Type" }, { key: "BACK", label: "Delete" }, { key: "▶▶", label: "Done" }]} />
    </DialogBackdrop>
  );
}
