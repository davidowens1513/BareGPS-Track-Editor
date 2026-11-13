import { it, expect } from "vitest";
import { readFileSync } from "node:fs";

it("keeps the finish action outside both fixed-width action rows", () => {
  const source = readFileSync(`${process.cwd()}/src/main.ts`, "utf8");
  const start = source.indexOf('<div id="input-edit-controls"');
  const end = source.indexOf('<div id="map-empty"', start);
  document.body.innerHTML = source.slice(start, end);
  const row = document.querySelector("#input-point-tools .drawing-modes")!;
  expect(
    [...row.querySelectorAll("button:not([hidden])")].map((b) => b.id),
  ).toEqual([
    "input-add",
    "input-insert",
    "input-delete",
    "input-close",
    "input-reset",
  ]);
  expect(
    document.querySelectorAll("#input-extra-tools .drawing-modes > button"),
  ).toHaveLength(5);
  expect(
    document.getElementById("input-done")!.closest(".drawing-modes"),
  ).toBeNull();
  const finish = document.getElementById("input-finish-tools")!;
  expect(finish.parentElement!.id).toBe("input-edit-controls");
  expect(finish.hidden).toBe(true);
  finish.hidden = false;
  expect(row.querySelectorAll("button:not([hidden])")).toHaveLength(5);
  expect(finish.querySelector("#input-done")).not.toBeNull();
});
