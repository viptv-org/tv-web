import type { QueryControl } from '../../vendor/engine/wire';

export interface DiscoveryCatalogDescriptor {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly connection_id: string;
  readonly connection_name?: string | null;
  readonly addon_id?: number | null;
  readonly controls: readonly QueryControl[];
}
export interface DiscoveryControls {
  readonly provider_id: string;
  readonly media_types: readonly string[];
  readonly controls: readonly QueryControl[];
  readonly catalogs: readonly DiscoveryCatalogDescriptor[];
  readonly discovery: { readonly availability: string; readonly message?: string | null };
}
