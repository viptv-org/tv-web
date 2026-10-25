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
// Git may materialize pinned text as CRLF on Windows; binary artwork stays byte-exact.
const matchesPinned = (path, bytes, expected) =>
  digest(bytes) === expected ||
  (/\.(?:md|json|svg)$/.test(path) || path.endsWith("/LICENSE")) &&
    digest(Buffer.from(bytes.toString("utf8").replaceAll("\r\n", "\n"))) === expected;
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
  // Session handoffs are operational notes, not product contracts or assets.
  // They can contain private runtime/account details and must not be vendored.
  const docs = paths.filter(
    (p) => p.endsWith(".md") && p !== "HANDOFF.md" && !p.startsWith("assets/") && !p.startsWith("prototypes/"),
  );
  const imagePrefix = "assets/roku/roku/images/";
  // Ship only the artwork the app loads: the launcher mark, the generated and
  // character avatars (avatarCatalog.ts) and the Lucide control icons
  // (actionIcons.ts, vectorIcons.ts). These directories are addressed
  // dynamically, so they are imported whole; legacy Roku frames stay in design.
  const shipped = (name) =>
    name === "viptv-mark.png" ||
    name.startsWith("avatar-catalog/") ||
    (name.startsWith("avatar-characters/") && name.endsWith(".png")) ||
    name.startsWith("lucide/");
  const assets = paths.filter(
    (p) => p.startsWith(imagePrefix) && shipped(p.slice(imagePrefix.length)),
  );
  const data = paths.filter((p) =>
    /^assets\/roku\/roku\/data\/(?:avatar-catalog|character-avatars)\.json$/.test(
      p,
    ),
  );
  const designSystemData = paths.filter((p) => [
    "viptv-design-system/tokens/tokens.json",
    "viptv-design-system/tools/targets.json",
    "viptv-design-system/reference/screens/index.json",
    "viptv-design-system/reference/assets/c5e059aaab8694dc24d6eac5443251d7.jpg",
    "viptv-design-system/reference/assets/583431e4f79c9c282528008fe0dc55d1.jpg",
    "viptv-design-system/reference/assets/b3223e2a084e414007a98927d4dacb2a.jpg",
    "viptv-design-system/reference/assets/4ad1cd0344ed6671f51e0752cec8f76a.jpg",
    "viptv-design-system/reference/assets/77f3ff5fe16cf0addfc249bcf775431c.jpg",
    "viptv-design-system/reference/assets/73769fe97de6261d73028ef33ba3c67c.jpg",
    "viptv-design-system/reference/assets/cf9ac68563546726c448b391311deb20.jpg",
    "viptv-design-system/reference/assets/853a629260ff2e6e91c508e50cbc4cfd.jpg",
    "viptv-design-system/reference/assets/1b8e776fadffacda0429eae19567c9d9.jpg",
    "viptv-design-system/reference/assets/7a243334ecd247bb9e774aab5e88b96c.jpg",
    "viptv-design-system/reference/assets/f1317811427e2bdd076d68c8137f0d3a.jpg",
    "viptv-design-system/reference/assets/6df8de10da7fd21be30c813631b351fd.jpg",
    "viptv-design-system/reference/assets/a58ce52f4693189507a3a209139fb1e8.jpg",
    "viptv-design-system/reference/assets/86e41958ebe13339a4428a67a45cf9af.jpg",
    "viptv-design-system/reference/assets/73adb3881e6289889a341e90548146a3.jpg",
    "viptv-design-system/reference/assets/f8d575b124e315021fc7157db89c7315.jpg",
    "viptv-design-system/reference/assets/138b3e7eec5324db705f886653b91819.jpg",
    "viptv-design-system/reference/assets/9655a617b392ac7c81fc6f78c3d48e5d.jpg",

    "viptv-design-system/reference/assets/5112cc304140378385555c10e98d120d.png",
    "viptv-design-system/reference/assets/e12f8d0854be9217fda190bd7a21aebd.png",
  ].includes(p));
  const previous = existsSync(
    resolve(root, "design-contract/snapshot-lock.json"),
  )
    ? JSON.parse(read("design-contract/snapshot-lock.json")).files
    : {};
  const imports = [];
  for (const source of [...docs, ...designSystemData, ...paths.filter(p => p.startsWith("tokens/") && p.endsWith(".json")), "assets/FILES.json", ...data, ...assets]) {
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
    if (!matchesPinned(path, read(path), entry.sha256))
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
