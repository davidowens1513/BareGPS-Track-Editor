import {
  readdir,
  readFile,
  stat,
  mkdir,
  rename,
  writeFile,
  realpath,
  rmdir,
} from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const numberedPart = /^(.*) ([1-9]\d*)(\.[^.]*)?$/;
const originalPart = (part) =>
  part.replace(numberedPart, (match, stem, number, extension = "") =>
    Number(number) >= 2 ? stem + extension : match,
  );
const hash = (data) => createHash("sha256").update(data).digest("hex");
async function exists(file) {
  try {
    return (await stat(file)).isFile();
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

export function nativeRoots(root = projectRoot) {
  return [
    "dist",
    "web-dist",
    "ios/App/App/public",
    "android/app/src",
    "android/app/src/main/assets",
    "android/app/build",
    "android/build",
    "android/capacitor-cordova-android-plugins/src",
    "android/capacitor-cordova-android-plugins/build",
    "node_modules/@capacitor/android/capacitor/src",
    "node_modules/@capacitor/android/capacitor/build",
    "node_modules/@capacitor/geolocation/android/src",
    "node_modules/@capacitor/geolocation/android/build",
  ].map((p) => path.join(root, p));
}

export async function inspectNativeFiles(
  root = projectRoot,
  roots = nativeRoots(root),
  compare = false,
) {
  const generatedRoots = nativeRoots(root).filter(
    (dir) => path.basename(dir) !== "src",
  );
  const generated = (file) =>
    generatedRoots.some((dir) => file.startsWith(dir + path.sep));
  const found = new Map();
  async function examine(file, scope) {
    const relative = path.relative(scope, file);
    const parts = relative.split(path.sep);
    const canonical = parts.map(originalPart).join(path.sep);
    const androidResource = /(?:^|[\\/])res[\\/]/.test(file);
    if (
      canonical === relative &&
      !(androidResource && parts.some((p) => p.includes(" ")))
    )
      return;
    const original = path.join(scope, canonical);
    const rebuildable = generated(file);
    const data = compare && !rebuildable ? await readFile(file) : null;
    const same =
      data !== null &&
      canonical !== relative &&
      (await exists(original)) &&
      data.equals(await readFile(original));
    found.set(file, {
      file,
      original: canonical !== relative ? original : null,
      generated: rebuildable,
      identical: same,
      bytes: data?.length ?? null,
      sha256: data ? hash(data) : null,
    });
  }
  async function walk(dir, scope = dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(file, scope);
      else if (entry.isFile()) await examine(file, scope);
      // Do not traverse symlinks into other checkouts or external caches.
    }
  }
  const realRoot = await realpath(root);
  for (const dir of roots) {
    try {
      const resolved = await realpath(dir);
      if (path.relative(realRoot, resolved).startsWith("..")) continue;
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    await walk(dir);
  }
  const ios = path.join(root, "ios/App/App");
  let entries = [];
  try {
    entries = await readdir(ios);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  for (const name of entries)
    if (/^config [1-9]\d*\.xml$/.test(name))
      await examine(path.join(ios, name), ios);
  return [...found.values()];
}

export async function checkNativeFiles({
  root = projectRoot,
  repair = false,
  roots,
} = {}) {
  const entries = await inspectNativeFiles(root, roots, repair);
  if (!entries.length) return { entries, backup: null };
  const conflicts = entries.filter((e) => !e.identical && !e.generated);
  if (!repair || conflicts.length) {
    const list = (repair && conflicts.length ? conflicts : entries)
      .map(
        (e) =>
          `  ${path.relative(root, e.file)} (${e.generated ? "generated copy — can be preserved and regenerated" : !repair ? "requires comparison — kept untouched" : e.identical ? "identical numbered copy" : "different, unmatched, or invalid resource name — kept untouched"})`,
      )
      .join("\n");
    throw new Error(
      `Native file check stopped the operation:\n${list}\n${repair && conflicts.length ? "Compare these files with their intended originals before moving them." : "Run npm run native:repair to quarantine safe copies, then clean and rebuild in the IDE."}`,
    );
  }
  const backup = path.join(
    root,
    ".native-file-backups",
    new Date().toISOString().replace(/[:.]/g, "-") + "-" + randomUUID(),
  );
  await mkdir(backup, { recursive: true });
  // Record the complete recovery inventory before moving any files.
  await writeFile(
    path.join(backup, "manifest.json"),
    JSON.stringify(
      {
        date: new Date().toISOString(),
        entries: entries.map((e) => ({
          ...e,
          file: path.relative(root, e.file),
          original: e.original ? path.relative(root, e.original) : null,
        })),
      },
      null,
      2,
    ) + "\n",
    { flag: "wx" },
  );
  for (const entry of entries) {
    const destination = path.join(backup, path.relative(root, entry.file));
    if (path.relative(backup, destination).startsWith(".."))
      throw new Error("Backup destination is outside this project.");
    // Recheck immediately before moving: never quarantine a copy that changed during scanning.
    if (!entry.generated) {
      const data = await readFile(entry.file);
      if (
        hash(data) !== entry.sha256 ||
        !data.equals(await readFile(entry.original))
      )
        throw new Error(
          `File changed during inspection; stopped: ${entry.file}`,
        );
    }
    await mkdir(path.dirname(destination), { recursive: true });
    await rename(entry.file, destination);
  }
  // Remove only now-empty numbered parent directories; their mirrored paths
  // already exist in the quarantine. Empty invalid resource folders also break AAPT.
  for (const entry of entries) {
    let directory = path.dirname(entry.file);
    while (
      directory !== root &&
      path
        .relative(root, directory)
        .split(path.sep)
        .some((p) => originalPart(p) !== p)
    ) {
      try {
        await rmdir(directory);
      } catch (error) {
        if (error.code === "ENOTEMPTY" || error.code === "ENOENT") break;
        throw error;
      }
      directory = path.dirname(directory);
    }
  }
  return { entries, backup };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const result = await checkNativeFiles({
      repair: process.argv.includes("--repair"),
    });
    console.log(
      result.backup
        ? `Quarantined ${result.entries.length} safe native/generated copies in ${result.backup}`
        : "Native file check passed.",
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
