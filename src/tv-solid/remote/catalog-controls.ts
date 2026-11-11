import type { Accessor, Setter } from "solid-js";
import type { Catalog, Control, Controls, Page } from "./types";
import type { Screen } from "./app-types";
import type { DialogActions, TextPrompt } from "./feature-ports";
import type { RemoteTvApi } from "./api";

export function createCatalogControls(options: {
  screen: Accessor<Screen>; stremioOnly: boolean;
  catalog: Accessor<Catalog | undefined>; controls: Accessor<Controls | undefined>; selectCatalog: Setter<Catalog | undefined>; prompt: TextPrompt;
  filters: {current: Accessor<Record<string, string[]>>; set: Setter<Record<string, string[]>>};
  page: Setter<Page>; loading: Setter<boolean>; column: Setter<number>;
  restart: () => AbortSignal; discover: RemoteTvApi["discover"];
  dialogs: Pick<DialogActions, "open" | "close">;
}) {
  const {catalog, page: setPage, loading: setLoading, column: setColumn, restart: restartPaging} = options;
  const {current: filters, set: setFilters} = options.filters;
  const {open: openOverlay, close: closeOverlay} = options.dialogs;
  function browseQuery(skip = "0") {
    const current = catalog(),
      anime = options.stremioOnly && options.screen() === "anime";
    return {
      type: anime ? "series" : options.screen(),
      catalog: current?.id,
      addon_id: current?.addon_id,
      skip,
      ...(anime ? { genre: "Animation" } : {}),
      values: Object.entries(filters())
        .filter(([id]) => !(anime && id === "genre"))
        .map(([id, values]) => ({ id, values })),
    };
  }
  async function loadBrowse() {
    const signal = restartPaging();
    setLoading(true);
    setPage({ cards: [], complete: true });
    try {
      setPage(await options.discover(browseQuery(), signal));
      setColumn(0);
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }
  function filtersOverlay(control: Control) {
    const chosen = filters()[control.id] ?? [];
    openOverlay({
      kind: "choices",
      title: control.label,
      items: [
        {
          id: "clear",
          label: "All",
          run: async () => {
            setFilters((old) => ({ ...old, [control.id]: [] }));
            closeOverlay();
            await loadBrowse();
          },
        },
        ...control.choices.map((item) => ({
          id: item.value,
          label: item.label,
          value: chosen.includes(item.value) ? "✓" : "",
          run: async () => {
            const values = filters()[control.id] ?? [];
            const next =
              control.maximum_selections && control.maximum_selections > 1
                ? values.includes(item.value)
                  ? values.filter((v) => v !== item.value)
                  : [...values, item.value].slice(-control.maximum_selections)
                : [item.value];
            setFilters((old) => ({ ...old, [control.id]: next }));
            closeOverlay();
            await loadBrowse();
          },
        })),
      ],
    });
  }
  function activate(column: number) {
    if (column === 0)
      openOverlay({
        kind: "choices",
        title: "Choose a catalog",
        items: (options.controls()?.catalogs ?? []).map((c) => ({
          id: c.id,
          label: c.name,
          description: c.connection_name,
          run: async () => {
            options.selectCatalog(c);
            setFilters({});
            closeOverlay();
            await loadBrowse();
          },
        })),
      });
    else
      openOverlay({
        kind: "choices",
        title: "Filters",
        items: (catalog()?.controls ?? []).map((control) => ({
          id: control.id,
          label: control.label,
          value: (filters()[control.id] ?? [])
            .map(
              (value) =>
                control.choices.find((choice) => choice.value === value)
                  ?.label ?? value,
            )
            .join(", "),
          run: () => {
            if (control.choices.length) filtersOverlay(control);
            else
              options.prompt(control.label, async (value) => {
                setFilters((old) => ({ ...old, [control.id]: [value] }));
                closeOverlay();
                await loadBrowse();
              });
          },
        })),
      });
  }
  return {activate, query: browseQuery, load: loadBrowse, choose: filtersOverlay};
}
