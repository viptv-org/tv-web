import type { Accessor } from "solid-js";
import { defaultDisplayPreferences } from "./display";
import type { DisplayPreferences, Preferences } from "./types";
import type { Item } from "./app-types";
import type { DialogActions, ScopedRequest } from "./feature-ports";

/** Server revision receipts remain authoritative for each preference edit. */
export function createPreferenceControls(options: {
  current: Accessor<Preferences | undefined>;
  adopt: (value: Preferences) => void;
  request: ScopedRequest;
  path: () => string;
  reload: () => Promise<void>;
  dialogs: Pick<DialogActions, "open" | "close">;
  calibrate: (value: number) => void;
}) {
  const {current: preferences, adopt: setPreferences, request: call, calibrate: setCalibrationValue} = options;
  const {open: openOverlay, close: closeOverlay} = options.dialogs;
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
            options.path(),
            "PUT",
            {
              revision: previous.revision,
              preferences: { ...previous.preferences, [field]: value },
            },
          );
          setPreferences(receipt);
          closeOverlay();
          await options.reload();
        },
      })),
    });
  }
  /** Tv3SetDisplay rows: swatches and toggles adjust inline; text size,
   * motion and screen saver use the shared choice overlay; Fit to screen
   * opens the calibration overlay. Every change is a confirmed server write. */
  function displayItem(
    control: NonNullable<Preferences["controls"]>[number],
  ): Item {
    const display = () => preferences()?.display ?? defaultDisplayPreferences;
    const put = async (patch: Partial<DisplayPreferences>) => {
      const previous = preferences()!;
      const receipt = await call<Preferences>(
        options.path(),
        "PUT",
        {
          revision: previous.revision,
          display: { ...previous.display, ...patch },
        },
      );
      setPreferences(receipt);
      await options.reload();
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
        // Directional picks are already persisted; Select only confirms.
        run: () => {},
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
  return {choice: preferenceChoice, displayItem};
}
