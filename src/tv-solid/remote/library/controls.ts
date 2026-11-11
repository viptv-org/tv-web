import { createMemo, type Accessor, type Setter } from "solid-js";
import type { Control, LibraryPage, LibraryQuery } from "../types";
import type { DialogActions } from "../feature-ports";

export function createLibraryControls(options: {
  current: Accessor<LibraryPage | undefined>;
  apply: (values: LibraryQuery) => Promise<void>;
  dialogs: Pick<DialogActions, "open" | "close">;
  selection: {current: Accessor<number>; set: Setter<number>};
}) {
  const {current: library} = options;
  const {open: openOverlay, close: closeOverlay} = options.dialogs;
  const {current: choice, set: setChoice} = options.selection;
  const libraryType = createMemo(() =>
    library()?.controls?.find((c) => c.id === "type"),
  );
  const librarySort = createMemo(() =>
    library()?.controls?.find((c) => c.id === "sort"),
  );
  const libraryDefaultQuery = () => {
    const base = library()?.default_query ?? library()?.query ?? {};
    const lastWatched = librarySort()?.choices.find(
      (choice) => choice.value === "last_watched",
    );
    return lastWatched ? { ...base, sort: lastWatched.value } : base;
  };
  const libraryFilters = createMemo(() =>
    (library()?.controls ?? []).filter(
      (c) => c.id !== "type" && c.id !== "sort" && c.choices.length,
    ),
  );
  const libraryControlCount = () => 2 + 1;
  let libraryApplying = false;
  async function applyLibrary(values: LibraryQuery) {
    libraryApplying = true;
    try { await options.apply(values); }
    finally { libraryApplying = false; }
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
  return {type: libraryType, sort: librarySort, filters: libraryFilters, defaults: libraryDefaultQuery,
    count: libraryControlCount, applying: () => libraryApplying, apply: applyLibrary, choose: chooseLibrary};
}
