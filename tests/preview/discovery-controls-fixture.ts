import type { DiscoveryControls } from '../../src/api/discovery-types';
import type { QueryControl } from '../../vendor/engine/wire';
/** Independent host fixture for browser interaction checks; never imported by the app. */
export function fixtureDiscoveryControls(catalogs: Record<string, any>[], type: string): DiscoveryControls {
  const records = catalogs.filter(catalog => catalog.type === type).map(catalog => ({
    id: catalog.id as string, name: catalog.name as string, type,
    connection_id: `stremio:${catalog.addon_id}`, connection_name: catalog.addon_name ?? 'Fixture add-on',
    addon_id: catalog.addon_id as number,
    controls: (catalog.extra ?? []).filter((extra: Record<string, any>) => extra.name !== 'skip' && extra.options_limit !== 0)
      .map((extra: Record<string, any>): QueryControl => ({ id: extra.name, label: extra.name === 'genre' ? 'Genre' : extra.name,
        kind: extra.options?.length ? (extra.options_limit ?? 1) > 1 ? 'MultiChoice' : 'SingleChoice' : 'Text',
        required: !!extra.is_required && !extra.default,
        choices: (extra.options ?? []).map((value: string) => ({ value, label: value })),
        minimum: null, maximum: null, maximum_selections: extra.options_limit ?? 1 })),
  }));
  return { provider_id: 'stremio', media_types: [...new Set(catalogs.map(catalog => String(catalog.type)))],
    controls: [], catalogs: records, discovery: { availability: records.length ? 'Available' : 'NotSupported' } };
}
