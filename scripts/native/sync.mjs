import { spawnSync } from "node:child_process";
import path from "node:path";
import { checkNativeFiles, projectRoot } from "./files.mjs";

const env = {
  ...process.env,
  PATH:
    path.dirname(process.execPath) + path.delimiter + (process.env.PATH ?? ""),
};
function run(file, args = []) {
  const result = spawnSync(
    process.execPath,
    [path.join(projectRoot, file), ...args],
    { cwd: projectRoot, stdio: "inherit", env },
  );
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(
      `${file} failed (${result.signal ?? result.status}). Native preparation stopped.`,
    );
}
async function inspect() {
  const result = await checkNativeFiles({ repair: true });
  if (result.backup)
    console.log(
      `Preserved ${result.entries.length} native/generated copies in ${result.backup}`,
    );
}
try {
  await inspect();
  if (!process.argv.includes("--copy-only")) {
    run("node_modules/typescript/bin/tsc", ["--noEmit"]);
    run("node_modules/vite/bin/vite.js", ["build"]);
  }
  run("node_modules/@capacitor/cli/bin/capacitor", [
    process.argv.includes("--copy-only") ? "copy" : "sync",
  ]);
  // Catch copies that appear during native refresh, including config.xml and public assets.
  await inspect();
  run("scripts/distribution/normalize-ios-package.mjs");
  await checkNativeFiles();
  console.log("Native assets prepared and checked.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
