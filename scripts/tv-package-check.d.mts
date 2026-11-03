export interface UnreachableFile {
  readonly file: string;
  readonly reason: 'browser-app' | 'desktop-bridge';
  readonly module: string;
}

export interface TvManifest {
  readonly base?: string;
  readonly files: readonly string[];
  readonly unreachable?: readonly UnreachableFile[];
}

export interface Reference {
  readonly from: string;
  readonly to: string;
}

export interface MissingReference extends Reference {
  readonly reference: string;
}

export interface PackageReport {
  readonly allowed: readonly Reference[];
  readonly files: readonly string[];
  readonly missing: readonly MissingReference[];
  readonly present: ReadonlySet<string>;
}

export interface PackageVerification extends PackageReport {
  readonly problems: readonly string[];
}

export function javascriptReferences(code: string): Set<string>;
export function markupReferences(code: string): Set<string>;
export function stylesheetReferences(code: string): Set<string>;
export function resolveReference(fromFile: string, reference: string, base: string): string | null;
export function scanTvPackage(directory: string, manifest: TvManifest): Promise<PackageReport>;
export function verifyTvPackage(directory: string, manifest: TvManifest): Promise<PackageVerification>;