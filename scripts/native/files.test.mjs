import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
  symlink,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { checkNativeFiles, inspectNativeFiles } from "./files.mjs";

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "baregps-native-files-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const put = async (file, text = "same") => {
    const target = path.join(root, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, text);
    return target;
  };
  return { root, put };
}
test("quarantines only identical copies, keeps originals, and records recoverable bytes", async (t) => {
  const { root, put } = await fixture(t);
  await put("android/app/src/main/res/xml/config.xml");
  await put("android/app/src/main/res/xml/config 2.xml");
  await put("android/app/src/main/res/xml/config 12.xml");
  const result = await checkNativeFiles({ root, repair: true });
  assert.equal(result.entries.length, 2);
  assert.equal(
    await readFile(
      path.join(root, "android/app/src/main/res/xml/config.xml"),
      "utf8",
    ),
    "same",
  );
  assert.deepEqual(
    await readdir(path.join(root, "android/app/src/main/res/xml")),
    ["config.xml"],
  );
  const manifest = JSON.parse(
    await readFile(path.join(result.backup, "manifest.json"), "utf8"),
  );
  for (const entry of manifest.entries)
    assert.equal(
      await readFile(path.join(result.backup, entry.file), "utf8"),
      "same",
    );
  assert.equal((await checkNativeFiles({ root, repair: true })).backup, null);
});
test("differing or unmatched copies stop repair before moving any files", async (t) => {
  const { root, put } = await fixture(t);
  const original = await put("ios/App/App/config.xml", "original");
  const identical = await put("ios/App/App/config 2.xml", "original");
  const changed = await put("ios/App/App/config 3.xml", "different");
  const unmatched = await put(
    "android/app/src/main/res/xml/missing 2.xml",
    "unique",
  );
  await assert.rejects(
    checkNativeFiles({ root, repair: true }),
    /kept untouched/,
  );
  assert.equal(await readFile(original, "utf8"), "original");
  assert.equal(await readFile(identical, "utf8"), "original");
  assert.equal(await readFile(changed, "utf8"), "different");
  assert.equal(await readFile(unmatched, "utf8"), "unique");
});
test("read-only check reports duplicates without modifying them", async (t) => {
  const { root, put } = await fixture(t);
  await put("dist/index.html");
  const duplicate = await put("dist/index 2.html");
  await assert.rejects(checkNativeFiles({ root }), /native:repair/);
  assert.equal(await readFile(duplicate, "utf8"), "same");
});
test("finds duplicate classes in the actual geolocation module output", async (t) => {
  const { root, put } = await fixture(t);
  const directory =
    "node_modules/@capacitor/geolocation/android/build/intermediates/classes";
  await put(directory + "/Plugin$startWatch$1.class");
  await put(directory + "/Plugin$startWatch$1 2.class");
  assert.equal((await inspectNativeFiles(root)).length, 1);
});
test("detects numbered directories as well as numbered filenames", async (t) => {
  const { root, put } = await fixture(t);
  await put("android/app/src/main/res/drawable/icon.xml");
  await put("android/app/src/main/res/drawable 2/icon.xml");
  const result = await checkNativeFiles({ root, repair: true });
  assert.equal(result.entries.length, 1);
  await assert.rejects(
    readdir(path.join(root, "android/app/src/main/res/drawable 2")),
    { code: "ENOENT" },
  );
  assert.equal(
    await readFile(
      path.join(result.backup, "android/app/src/main/res/drawable 2/icon.xml"),
      "utf8",
    ),
    "same",
  );
});
test("invalid Android resource names stop the check even without a numbered suffix", async (t) => {
  const { root, put } = await fixture(t);
  const file = await put("android/app/src/main/res/drawable/bad icon.xml");
  await assert.rejects(
    checkNativeFiles({ root, repair: true }),
    /invalid resource name/,
  );
  assert.equal(await readFile(file, "utf8"), "same");
});
test("does not traverse nested symlinks into another checkout", async (t) => {
  const { root, put } = await fixture(t);
  await put("elsewhere/config.xml");
  await put("elsewhere/config 2.xml");
  await mkdir(path.join(root, "dist"), { recursive: true });
  await symlink(
    path.join(root, "elsewhere"),
    path.join(root, "dist", "linked"),
    "dir",
  );
  assert.equal((await inspectNativeFiles(root)).length, 0);
});
test("a normal native tree and intentional filename spaces outside resources pass", async (t) => {
  const { root, put } = await fixture(t);
  await put("ios/App/App/config.xml");
  await put("dist/Walking route.txt");
  assert.equal((await checkNativeFiles({ root })).entries.length, 0);
});

test("preserves stale generated copies even if the current output differs", async (t) => {
  const { root, put } = await fixture(t);
  await put("ios/App/App/public/index.html", "current");
  await put("ios/App/App/public/index 2.html", "older generated output");
  const result = await checkNativeFiles({ root, repair: true });
  assert.equal(
    await readFile(
      path.join(result.backup, "ios/App/App/public/index 2.html"),
      "utf8",
    ),
    "older generated output",
  );
  assert.equal(
    await readFile(path.join(root, "ios/App/App/public/index.html"), "utf8"),
    "current",
  );
});
