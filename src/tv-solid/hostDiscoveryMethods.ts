import type { Catalog, TvApi } from '../api';
import { discoveryCatalogs } from '../api/engine-discovery';
import { discoverChips, initialCatalog, sameCatalog, type DiscoverChipView } from './discoverModel';
import type { DiscoveryValues } from './discoveryQuery';

type Scope = ReturnType<TvApi['createScope']>;
export interface DiscoveryFallback {
  phase: string; railExpanded: boolean; discoverFilterOpen: boolean; textEntry: unknown;
  discoverChips: DiscoverChipView[];
  focusDiscoverChip: (index: number) => void; openRail: () => void;
}
/** Empty/error/required-input states still need a visible remote-focus destination. */
export function focusDiscoverFallback(context: DiscoveryFallback, name?: string, index = 0) {
  queueMicrotask(() => {
    if (context.phase !== 'discover' || context.railExpanded || context.discoverFilterOpen || context.textEntry) return;
    const preferred = context.discoverChips.findIndex(chip => chip.visible && chip.kind === 'filter' && chip.value === name);
    if (context.discoverChips.some(chip => chip.visible)) context.focusDiscoverChip(preferred >= 0 ? preferred : index);
    else context.openRail();
  });
}
interface HostDiscoveryContext extends DiscoveryFallback {
  discoverType: string; discoverTypes: string[]; discoverCatalogs: Catalog[]; discoverCatalog: Catalog | null;
  discoverBusy: boolean; discoverError: string;
  loadDiscoverCatalog: (catalog: Catalog, values?: DiscoveryValues, skip?: number, focusCard?: boolean) => Promise<void>;
  revealDiscoverChips: () => void;
}
export function hostDiscoveryMethods(api: TvApi, begin: () => { scope: Scope; generation: number }, current: (generation: number) => boolean) {
  return {
    async loadDiscoverType(this: HostDiscoveryContext, type: string) {
      const { scope, generation } = begin();
      this.discoverBusy = true; this.discoverError = '';
      try {
        let controls = await api.discoveryControls(type, { signal: scope.signal });
        if (!current(generation) || scope.signal.aborted || this.phase !== 'discover') return;
        if (!controls.media_types.includes(type) && controls.media_types[0]) {
          type = controls.media_types[0];
          controls = await api.discoveryControls(type, { signal: scope.signal });
          if (!current(generation) || scope.signal.aborted || this.phase !== 'discover') return;
        }
        this.discoverTypes = [...controls.media_types]; this.discoverType = type;
        const available = discoveryCatalogs(controls, type);
        this.discoverCatalogs = available;
        const selected = available.find(candidate => sameCatalog(candidate, this.discoverCatalog ?? undefined)) ?? initialCatalog(available);
        if (selected) { await this.loadDiscoverCatalog(selected); return; }
        this.discoverCatalog = null; this.discoverBusy = false;
        this.discoverChips = discoverChips(available, undefined, {}, this.discoverTypes, type);
        this.discoverError = controls.discovery.message ?? 'No catalogs are available for this media type.';
        this.revealDiscoverChips(); focusDiscoverFallback(this);
      } catch (cause) {
        if (!current(generation) || scope.signal.aborted || this.phase !== 'discover') return;
        this.discoverBusy = false;
        this.discoverError = cause instanceof Error ? cause.message : 'Unable to load discovery filters.';
        focusDiscoverFallback(this);
      }
    },
  };
}
