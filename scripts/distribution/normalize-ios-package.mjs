import { readFile, writeFile } from "node:fs/promises";
const url = new URL("../../ios/App/CapApp-SPM/Package.swift", import.meta.url);
const source = await readFile(url, "utf8");
const result = source.replace(
  /(\.package\(name: "CapacitorGeolocation", path: ")[^"]+("\))/,
  "$1../../../node_modules/@capacitor/geolocation$2",
);
if (!result.includes('path: "../../../node_modules/@capacitor/geolocation"'))
  throw new Error("Could not normalise the iOS dependency path.");
await writeFile(url, result);
