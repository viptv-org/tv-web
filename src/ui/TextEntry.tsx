import { useEffect, useState } from "react";
import { TvButton, focusElement } from "./remote";
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
    [lower, setLower] = useState(false);
  useEffect(() => {
    focusElement("text-key-0");
  }, []);
  const save = async () => {
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
    ? "0123456789"
    : `${lower ? "abcdefghijklmnopqrstuvwxyz" : "ABCDEFGHIJKLMNOPQRSTUVWXYZ"}0123456789:/.-_@`;
  return (
    <div className="text-entry" data-focus-scope="entry">
      <h1>{title}</h1>
      <input
        aria-label={title}
        type={secret ? "password" : "text"}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoComplete="off"
        maxLength={secret ? 12 : 2048}
      />
      <div className="entry-keys">
        {keys.split("").map((c, i) => (
          <TvButton
            id={`text-key-${i}`}
            key={i}
            onActivate={() => setValue((v) => v + c)}
          >
            {c}
          </TvButton>
        ))}
      </div>
      <div className="actions">
        {!secret && (
          <>
            <TvButton id="text-case" onActivate={() => setLower(!lower)}>
              Aa
            </TvButton>
            <TvButton
              id="text-space"
              onActivate={() => setValue((v) => v + " ")}
            >
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
        <TvButton
          id="text-save"
          disabled={pending}
          onActivate={() => void save()}
        >
          Save
        </TvButton>
        <TvButton id="text-cancel" onActivate={onCancel}>
          Cancel
        </TvButton>
      </div>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
