import type { Catalog, JsonObject } from './types';
import type { DiscoveryControls } from './discovery-types';
import type { QueryControl } from '../../vendor/engine/wire';

/** Presentation adapter only: provider validation and request construction stay on the host. */
export function discoveryCatalogs(controls: DiscoveryControls, type: string): Catalog[] {
  const catalogs = controls.catalogs.filter(catalog => catalog.type === type);
  if (controls.discovery.availability !== 'Available') return [];
  if (catalogs.length) return catalogs.map(catalog => project(catalog.id, catalog.name, catalog.type,
    catalog.connection_id, catalog.connection_name ?? undefined, catalog.addon_id ?? undefined, catalog.controls));
  if (controls.catalogs.length) return [];
  // A catalog-less provider advertises one aggregate for this media type. Empty id is never sent.
  if (!controls.media_types.includes(type)) return [];
  return [project('', 'All titles', type, controls.provider_id, undefined, undefined,
    controls.controls.filter(control => control.id !== 'type' && control.id !== 'catalog'))];
}
function project(id: string, name: string, type: string, connection: string, connectionName: string | undefined,
  addonId: number | undefined, controls: readonly QueryControl[]): Catalog {
  const raw = { host_controls: controls } as unknown as JsonObject;
  return { id, name, type, addonKey: connection, addonName: connectionName, addonId,
    supportsSearch: controls.some(control => control.id === 'search'), supportsSkip: true,
    extras: [], genres: [], raw };
}
export function hostCatalogControls(catalog: Catalog): readonly QueryControl[] | undefined {
  return Array.isArray(catalog.raw.host_controls) ? catalog.raw.host_controls as unknown as readonly QueryControl[] : undefined;
}
