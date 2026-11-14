import { readdir, readFile } from 'node:fs/promises';
import { extname, join, posix } from 'node:path';

/**
 * Resolve every reference a staged TV package makes to another package file.
 *
 * The package set itself comes from the build's import graph (`tv-assets.json`),
 * so this check is the proof that the set is complete: it re-reads the emitted
 * JavaScript, HTML and CSS and resolves each target against the files that were
 * actually copied. A reference may only be unresolved when it points at a file
 * the build declared unreachable for a TV (the React entry, the desktop bridge
 * and their dependency closures).
 */

/** Static and dynamic module specifiers plus Vite's literal preload arrays.
 * Minified output writes a specifier directly after its keyword, so prose that
 * merely contains the word "from" cannot be mistaken for an import. */
export function javascriptReferences(code) {
  const references = new Set();
  // `import"./x.js"`, `from"./x.js"` and `import("./x.js")`.
  for (const match of code.matchAll(/\b(?:from|import)(?:\(\s*)?["']([^"']+)["']/g)) references.add(match[1]);
  // `__vite__mapDeps` entries and runtime public-asset paths.
  for (const match of code.matchAll(/["']([^"']*\/[^"']+\.[A-Za-z0-9]+)["']/g)) references.add(match[1]);
  return references;
}

function moduleReferences(code) {
  return new Set(Array.from(code.matchAll(/\b(?:from|import)(?:\(\s*)?["']([^"']+)["']/g), match => match[1]));
}

/** Script/link targets and inline `srcset`-free asset URLs in a document. */
export function markupReferences(code) {
  const references = new Set();
  for (const match of code.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/g)) references.add(match[1]);
  return references;
}

/** `url(...)` targets in a stylesheet. */
export function stylesheetReferences(code) {
  const references = new Set();
  for (const match of code.matchAll(/url\(\s*(["']?)([^"')]+)\1\s*\)/g)) references.add(match[2]);
  return references;
}

/** Every file in a staged package, as root-relative POSIX paths. */
async function listFiles(directory, prefix = '') {
  const entries = await readdir(join(directory, prefix), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = prefix ? posix.join(prefix, entry.name) : entry.name;
    if (entry.isDirectory()) files.push(...await listFiles(directory, path));
    else if (entry.isFile()) files.push(path);
  }
  return files.sort();
}

/** Turn one emitted reference into a root-relative package path, or null when
 * it is not a same-mount file reference (data URI, fragment, other origin).
 * Vite writes `__vite__mapDeps` entries base-relative (`assets/x.css`), which
 * has to be distinguished from a module specifier (`./x.js`). */
export function resolveReference(fromFile, reference, base) {
  if (!reference || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(reference)) return null;
  const path = reference.split(/[?#]/, 1)[0];
  if (!path) return null;
  if (path.startsWith('/')) return path.startsWith(base) ? path.slice(base.length) : null;
  if (!path.startsWith('./') && !path.startsWith('../')) return path;
  return posix.normalize(posix.join(posix.dirname(fromFile), path));
}

/** Read the staged package and resolve every reference inside it. */
export async function scanTvPackage(directory, manifest) {
  const base = manifest.base ?? '/';
  const files = await listFiles(directory);
  const present = new Set(files);
  const unreachable = new Set((manifest.unreachable ?? []).map(entry => entry.file));
  const missing = [];
  const declared = [];
  for (const file of files) {
    const extension = extname(file);
    const read = extension === '.js' ? javascriptReferences
      : extension === '.html' ? markupReferences
        : extension === '.css' ? stylesheetReferences
          : undefined;
    if (!read) continue;
    const code = await readFile(join(directory, file), 'utf8');
    const modules = extension === '.js' ? moduleReferences(code) : new Set();
    for (const reference of read(code)) {
      // BASE_URL public paths resolve from the document, unlike module imports.
      const target = base === './' && extension === '.js' && !modules.has(reference) && (reference.startsWith('./assets/') || reference.startsWith('./tv-artwork/'))
        ? posix.normalize(reference.slice(2))
        : resolveReference(file, reference, base);
      if (target === null || present.has(target)) continue;
      if (unreachable.has(target)) declared.push({ from: file, to: target });
      else missing.push({ from: file, to: target, reference });
    }
  }
  return { allowed: declared, files, missing, present };
}

/** Fail the package when anything a TV fetches did not make it into it. */
export async function verifyTvPackage(directory, manifest) {
  const report = await scanTvPackage(directory, manifest);
  const absent = manifest.files.filter(file => !report.present.has(file));
  const problems = [
    ...absent.map(file => `declared but not packaged: ${file}`),
    ...report.missing.map(entry => `${entry.from} references ${entry.reference} (${entry.to}), which is neither packaged nor declared unreachable`),
  ];
  return { ...report, problems };
}
