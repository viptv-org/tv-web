import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  readdirSync,
  existsSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const read = (path) => readFileSync(resolve(root, path));
const write = (path, bytes) => {
  mkdirSync(dirname(resolve(root, path)), { recursive: true });
  writeFileSync(resolve(root, path), bytes);
};
const git = (repo, args) =>
  execFileSync("git", ["-C", resolve(repo), ...args], {
    maxBuffer: 32 * 1024 * 1024,
  });
const safe = (path) =>
  typeof path === "string" &&
  !path.startsWith("/") &&
  !path.split("/").some((p) => p === ".." || p === "." || !p);
const list = (dir) =>
  readdirSync(resolve(root, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? list(`${dir}/${e.name}`) : [`${dir}/${e.name}`],
  );
const [command = "check", repo, revision] = process.argv.slice(2);

if (command === "sync") {
  if (!repo || !/^[a-f0-9]{40}$/.test(revision ?? ""))
    throw Error(
      "Usage: node scripts/design-sync.mjs sync ../design <full immutable commit>",
    );
  const commit = git(repo, ["rev-parse", `${revision}^{commit}`])
    .toString()
    .trim();
  const paths = git(repo, ["ls-tree", "-r", "--name-only", commit])
    .toString()
    .trim()
    .split("\n");
  const files = {};
  // Only committed canonical documents and app artwork enter the snapshot.
  // Private machine files, screenshots and working-tree edits are never read.
  const docs = paths.filter(
    (p) => p.endsWith(".md") && !p.startsWith("assets/"),
  );
  const imagePrefix = "assets/roku/roku/images/";
  const assets = paths.filter((p) => p.startsWith(imagePrefix));
  const data = paths.filter((p) =>
    /^assets\/roku\/roku\/data\/(?:avatar-catalog|character-avatars)\.json$/.test(
      p,
    ),
  );
  const previous = existsSync(
    resolve(root, "design-contract/snapshot-lock.json"),
  )
    ? JSON.parse(read("design-contract/snapshot-lock.json")).files
    : {};
  const imports = [];
  for (const source of [...docs, "assets/FILES.json", ...data, ...assets]) {
    if (!safe(source)) throw Error(`Unsafe design path: ${source}`);
    const destination = source.startsWith(imagePrefix)
      ? `public/assets/${source.slice(imagePrefix.length)}`
      : `design-contract/${source}`;
    const bytes = git(repo, ["show", `${commit}:${source}`]);
    imports.push({ destination, bytes });
    files[destination] = { source, sha256: digest(bytes) };
  }
  // Resolve every source before changing the working tree. Retired artwork is
  // removed only when the preceding lock identifies it as design-managed.
  for (const path of Object.keys(previous)) {
    if (!safe(path)) throw Error(`Invalid preceding snapshot path: ${path}`);
    if (path.startsWith("public/assets/") && !files[path])
      rmSync(resolve(root, path), { force: true });
  }
  rmSync(resolve(root, "design-contract"), { recursive: true, force: true });
  for (const { destination, bytes } of imports) write(destination, bytes);
  write("DESIGN_REF", `${commit}\n`);
  write(
    "design-contract/snapshot-lock.json",
    JSON.stringify(
      { version: 1, repository: "viptv-org/design", commit, files },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `Imported ${Object.keys(files).length} design documents and assets from ${commit}. Review the diff and parity matrix before committing.`,
  );
} else if (command === "check" || command === "freshness") {
  const pin = read("DESIGN_REF").toString().trim();
  const lock = JSON.parse(read("design-contract/snapshot-lock.json"));
  if (
    lock.version !== 1 ||
    lock.repository !== "viptv-org/design" ||
    !/^[a-f0-9]{40}$/.test(pin) ||
    lock.commit !== pin
  )
    throw Error(
      "Design pin and snapshot lock disagree. Run the explicit sync command.",
    );
  for (const [path, entry] of Object.entries(lock.files)) {
    if (
      !safe(path) ||
      !safe(entry.source) ||
      !(
        path.startsWith("design-contract/") || path.startsWith("public/assets/")
      )
    )
      throw Error(`Invalid snapshot path: ${path}`);
    if (digest(read(path)) !== entry.sha256)
      throw Error(
        `Design-owned file changed: ${path}. Update design first and sync its committed revision.`,
      );
  }
  for (const path of list("design-contract"))
    if (path !== "design-contract/snapshot-lock.json" && !lock.files[path])
      throw Error(`Untracked design snapshot file: ${path}`);
  for (const path of list("public/assets"))
    if (!lock.files[path])
      throw Error(`App artwork is not in the design pin: ${path}`);
  if (command === "freshness") {
    if (!repo)
      throw Error("Usage: node scripts/design-sync.mjs freshness ../design");
    const head = git(repo, ["rev-parse", "HEAD"]).toString().trim();
    if (head !== pin)
      throw Error(
        `Design checkout is ${head}; application pins ${pin}. Review upstream changes before updating.`,
      );
    // With authoritative source available, also verify the lock itself.
    for (const entry of Object.values(lock.files))
      if (
        digest(git(repo, ["show", `${pin}:${entry.source}`])) !== entry.sha256
      )
        throw Error(`Snapshot differs from pinned source: ${entry.source}`);
  }
  console.log(
    `Design snapshot integrity passed: ${pin}, ${Object.keys(lock.files).length} files. This does not certify visual or hardware parity.`,
  );
} else throw Error(`Unknown design-sync command: ${command}`);
