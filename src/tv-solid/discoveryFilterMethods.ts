import type { Catalog } from '../api';
import { catalogFilters, catalogFilterLabel, type CatalogFilter } from '../ui/catalogFilters';
import type { TextEntryProps } from './TextEntry';
import type { DiscoveryValues } from './discoveryQuery';
import { noteDiscoverFilter } from './focusDebug';

interface FilterContext {
  discoverCatalog: Catalog | null; discoverValues: DiscoveryValues;
  discoverFilter: CatalogFilter | null; discoverFilterName: string; discoverFilterOpen: boolean;
  discoverFilterReturnChip: number; discoverChipIndex: number;
  openTextEntry: (value: Omit<TextEntryProps, 'onCancel'>) => void;
  loadDiscoverCatalog: (catalog: Catalog, values?: DiscoveryValues, skip?: number, focusCard?: boolean) => Promise<void>;
  focusDiscoverChip: (index: number) => void;
}
export function discoveryFilterMethods(scope: () => Pick<AbortController, 'abort'> | undefined) {
  return {
    openDiscoverFilter(this: FilterContext, name: string) {
      const catalog = this.discoverCatalog;
      const filter = catalog && catalogFilters(catalog).find(candidate => candidate.name === name);
      if (!catalog || !filter) return;
      if (filter.kind === 'Toggle') {
        void this.loadDiscoverCatalog(catalog, { ...this.discoverValues,
          [name]: this.discoverValues[name] === 'true' ? 'false' : 'true' }, 0, false);
        return;
      }
      if (!filter.options.length) {
        this.openTextEntry({ title: filter.label ?? catalogFilterLabel(name),
          initialValue: typeof this.discoverValues[name] === 'string' ? this.discoverValues[name] as string : '', maxLength: 256,
          onSubmit: async (value, signal) => {
            const trimmed = value.trim();
            if (filter.required && !trimmed) throw new Error('Enter a value for this required filter.');
            const loading = this.loadDiscoverCatalog(catalog, { ...this.discoverValues, [name]: trimmed }, 0, false);
            const active = scope(), cancel = () => active?.abort();
            signal?.addEventListener('abort', cancel, { once: true });
            try { await loading; } finally { signal?.removeEventListener('abort', cancel); }
          } });
        return;
      }
      this.discoverFilterName = name;
      this.discoverFilter = filter;
      this.discoverFilterReturnChip = this.discoverChipIndex;
      this.discoverFilterOpen = true; noteDiscoverFilter(true);
    },
    closeDiscoverFilter(this: FilterContext) {
      if (!this.discoverFilterOpen) return;
      this.discoverFilterOpen = false; this.discoverFilter = null; noteDiscoverFilter(false);
      this.focusDiscoverChip(this.discoverFilterReturnChip);
    },
    applyDiscoverFilter(this: FilterContext, selected: readonly string[]) {
      const catalog = this.discoverCatalog, filter = this.discoverFilter;
      if (!catalog || !filter) return;
      const value = filter.kind === 'MultiChoice' ? [...selected] : selected[0] ?? '';
      this.discoverFilterOpen = false; this.discoverFilter = null; noteDiscoverFilter(false);
      this.focusDiscoverChip(this.discoverFilterReturnChip);
      void this.loadDiscoverCatalog(catalog, { ...this.discoverValues, [filter.name]: value }, 0, false);
    },
  };
}
