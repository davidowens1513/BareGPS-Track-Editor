import { describe, it, expect } from "vitest";
import {
  inputHandleIndices,
  localInputHandleIndices,
  insertInputPoint,
  deleteInputPoint,
  reshapeInputHandle,
  closeInputLoop,
  prepareInputTerrain,
  finishInputTerrain,
} from "../src/input-edit";
import {
  exportGPX,
  parseGPX,
  reverse,
  section,
  type Track,
} from "../src/model";
import { sampleGaps } from "../src/terrain";
import {
  addPlanSection,
  buildPlannedRoute,
  replacePlanSection,
} from "../src/route-plan";
const input = (count = 61): Track => ({
  id: "source",
  name: "Dense",
  source: "dense.gpx",
  kind: "track",
  color: "#d32f2f",
  points: Array.from({ length: count }, (_, i) => ({
    lat: 53 + i * 0.0001,
    lon: -6,
    ele: 100 + i,
    time: "2026-01-01T10:00:00Z",
    name: "P" + i,
  })),
});
describe("input geometry editing", () => {
  it("spaces handles without reducing the source and includes explicit and gap boundaries", () => {
    const t = input();
    expect(inputHandleIndices(t, 20)).toEqual([0, 20, 40, 60]);
    t.points[31].gapBefore = true;
    expect(inputHandleIndices(t, 20, [7, 99])).toEqual([
      0, 7, 20, 30, 31, 40, 60,
    ]);
    expect(t.points).toHaveLength(61);
    expect(() => inputHandleIndices(t, 0)).toThrow();
  });
  it("tapers movement to fixed neighbours and preserves all points and unaffected metadata", () => {
    const t = input();
    const changed = reshapeInputHandle(
      t,
      20,
      { lat: 53.002, lon: -5.999 },
      [0, 20, 40, 60],
    );
    expect(changed.points).toHaveLength(61);
    expect(t.points[20].lon).toBe(-6);
    expect(changed.points[0]).toBe(t.points[0]);
    expect(changed.points[40].lat).toBe(t.points[40].lat);
    expect(changed.points[50]).toBe(t.points[50]);
    expect(changed.points[20].lon).toBeCloseTo(-5.999, 8);
    expect(changed.points[10].lon).toBeCloseTo(-5.9995, 7);
    expect(changed.points[20].ele).toBeUndefined();
    expect(changed.points[20].time).toBeUndefined();
    expect(changed.points[20].name).toBe("P20");
    expect(changed.points[40].ele).toBe(140);
    expect(changed.points[40].terrainPending).toBe(true);
    expect(changed.points[41].terrainPending).toBeUndefined();
  });
  it("adds/inserts/deletes without changing other coordinates, and enforces minimum size", () => {
    const t = input(3),
      added = insertInputPoint(t, 1, { lat: 53.00005, lon: -5.9999 });
    expect(added.points).toHaveLength(4);
    expect(added.points[2].lat).toBe(t.points[1].lat);
    expect(added.points[2].ele).toBe(t.points[1].ele);
    const removed = deleteInputPoint(added, 1);
    expect(removed.points.map((p) => p.lat)).toEqual(
      t.points.map((p) => p.lat),
    );
    expect(removed.points[1].terrainPending).toBe(true);
    expect(() => deleteInputPoint(input(2), 0)).toThrow(/two/);
    expect(() => insertInputPoint(t, 1, t.points[0])).toThrow(/half/);
  });
  it("keeps both endpoints together when moving a closed loop", () => {
    const t = closeInputLoop(input());
    expect(t.points).toHaveLength(62);
    expect(t.points.at(-1)?.lat).toBe(t.points[0].lat);
    const moved = reshapeInputHandle(
      t,
      0,
      { lat: 53.0001, lon: -5.999 },
      inputHandleIndices(t, 20),
    );
    expect(moved.points.at(-1)?.lat).toBeCloseTo(moved.points[0].lat);
    expect(moved.points.at(-1)?.lon).toBeCloseTo(moved.points[0].lon);
    expect(closeInputLoop(t)).toBe(t);
  });
  it("restores solid versus gap styling after terrain sampling, retaining known heights", () => {
    const t = input(4);
    t.points[1].terrainPending = true;
    t.points[1].ele = undefined;
    t.points[3].gapBefore = true;
    const sampled = sampleGaps(prepareInputTerrain(t));
    sampled.points.forEach((p) => {
      p.ele = 500;
      p.terrain = true;
    });
    const result = finishInputTerrain(t, sampled);
    expect(result.points[0].ele).toBe(100);
    expect(result.points[1].ele).toBe(500);
    expect(result.points[1].gapBefore).toBeUndefined();
    expect(result.points[3].gapBefore).toBe(true);
    expect(
      result.points.every(
        (p) => !p.terrainPending && !("inputOriginalIndex" in p),
      ),
    ).toBe(true);
    const long = input(2);
    long.points[1] = { lat: 53.01, lon: -6, terrainPending: true };
    const dense = sampleGaps(prepareInputTerrain(long));
    expect(dense.points.length).toBeGreaterThan(2);
    expect(
      finishInputTerrain(long, dense).points.every((p) => !p.gapBefore),
    ).toBe(true);
  });
  it("preserves pending heights through GPX, reverse and A–B boundaries", () => {
    const t = input(4);
    t.points[2].terrainPending = true;
    const roundtrip = parseGPX(exportGPX(t), "roundtrip.gpx")[0];
    expect(roundtrip.points[2].terrainPending).toBe(true);
    const reversed = reverse(t);
    expect(reversed.points[2].terrainPending).toBe(true);
    expect(reversed.points[1].terrainPending).toBeUndefined();
    expect(
      section(t, { start: 2, end: 3 }).points[0].terrainPending,
    ).toBeUndefined();
  });
  it("isolates queued and confirmed copies until explicit replacement and reconfirmation", () => {
    const t = input(),
      plan = addPlanSection([], t, { start: 0, end: 60 }),
      confirmed = buildPlannedRoute(plan);
    const changed = reshapeInputHandle(
      t,
      20,
      { lat: 53.002, lon: -5.999 },
      inputHandleIndices(t, 20),
    );
    expect(plan[0].points[20].lon).toBe(-6);
    expect(confirmed.points[20].lon).toBe(-6);
    const replaced = replacePlanSection(plan, 0, changed, {
      start: 0,
      end: 60,
    });
    expect(replaced[0].id).not.toBe(plan[0].id);
    expect(replaced[0].points[20].lon).toBeCloseTo(-5.999);
    expect(confirmed.points[20].lon).toBe(-6);
    expect(buildPlannedRoute(replaced, confirmed).points[20].lon).toBeCloseTo(
      -5.999,
    );
  });
});

it("trims retain the selected point, preserve retained metadata and require two points", async () => {
  const { trimInputTrack } = await import("../src/input-edit");
  const t = input(61);
  t.points[20].gapBefore = true;
  t.points[20].terrainPending = true;
  const before = trimInputTrack(t, 20, "before");
  expect(before.points).toHaveLength(41);
  expect(before.points[0].lat).toBe(t.points[20].lat);
  expect(before.points[0].gapBefore).toBeUndefined();
  expect(before.points[0].terrainPending).toBeUndefined();
  expect(before.points[0].ele).toBe(120);
  expect(before.points[0].time).toBe(t.points[20].time);
  expect(before.points[1]).toBe(t.points[21]);
  expect(t.points).toHaveLength(61);
  const after = trimInputTrack(t, 20, "after");
  expect(after.points).toHaveLength(21);
  expect(after.points.at(-1)).toBe(t.points[20]);
  expect(() => trimInputTrack(t, 60, "before")).toThrow(/two/);
  expect(() => trimInputTrack(t, 0, "after")).toThrow(/two/);
  expect(() => trimInputTrack(t, 100, "after")).toThrow();
  expect(trimInputTrack(t, 59, "before").points).toHaveLength(2);
  expect(trimInputTrack(t, 1, "after").points).toHaveLength(2);
});

it("identifies missing heights and marks only missing or changed legs while preserving recorded values", async () => {
  const { needsTerrain } = await import("../src/input-edit");
  const t = input(4);
  expect(needsTerrain(t)).toBe(false);
  t.points[1].ele = undefined;
  expect(needsTerrain(t)).toBe(true);
  const prepared = prepareInputTerrain(t);
  expect(prepared.points.map((p) => !!p.gapBefore)).toEqual([
    false,
    true,
    true,
    false,
  ]);
  const sampled = sampleGaps(prepared);
  sampled.points.forEach((p) => {
    if (p.gapBefore || p.ele === undefined) {
      p.ele = 500;
      p.terrain = true;
    }
  });
  const completed = finishInputTerrain(t, sampled);
  expect(completed.points.map((p) => p.ele)).toEqual([100, 500, 102, 103]);
  expect(needsTerrain(completed)).toBe(false);
  t.points[3].gapBefore = true;
  expect(needsTerrain(t)).toBe(true);
});

describe("clean-line section editing", () => {
  it("keeps handles local and spaced by distance on dense and sparse recordings", () => {
    const dense = input(1001);
    const local = localInputHandleIndices(dense, 500, 100);
    expect(local).toHaveLength(7);
    expect(local).toContain(500);
    expect(local[0]).toBeGreaterThan(470);
    expect(local.at(-1)).toBeLessThan(530);
    const fine = localInputHandleIndices(dense, 500, 20);
    expect(fine[0]).toBeGreaterThan(local[0]);
    const sparse = input(3);
    expect(localInputHandleIndices(sparse, 1, 10)).toEqual([0, 1, 2]);
    dense.points[501].gapBefore = true;
    expect(
      localInputHandleIndices(dense, 500, 100).every((i) => i <= 500),
    ).toBe(true);
  });
  it("widens a large drag even when every recorded point is an editing handle", () => {
    const track = input(1001);
    const changed = reshapeInputHandle(
      track,
      500,
      { lat: track.points[500].lat, lon: -5.999 },
      [499, 500, 501],
    );
    const shift = changed.points[500].lon - track.points[500].lon;
    // Adjacent dense points follow almost the whole movement, avoiding a single-point spike.
    expect((changed.points[499].lon + 6) / shift).toBeGreaterThan(0.98);
    expect((changed.points[501].lon + 6) / shift).toBeGreaterThan(0.98);
    expect(changed.points[500].lon).toBeCloseTo(-5.999, 8);
    expect(changed.points[480]).toBe(track.points[480]);
    expect(changed.points[520]).toBe(track.points[520]);
    expect(changed.points).toHaveLength(track.points.length);
    expect(track.points[500].lon).toBe(-6);
  });
  it("blends gently at fixed anchors and at the moved point", () => {
    const track = input(101);
    const changed = reshapeInputHandle(
      track,
      50,
      { lat: track.points[50].lat, lon: -5.999 },
      [0, 50, 100],
    );
    const shift = changed.points[50].lon + 6;
    expect((changed.points[1].lon + 6) / shift).toBeLessThan(0.002);
    expect((changed.points[49].lon + 6) / shift).toBeGreaterThan(0.998);
    expect(changed.points[0]).toBe(track.points[0]);
    expect(changed.points[100].lon).toBe(track.points[100].lon);
  });
  it("does not reshape a disconnected segment across a gap", () => {
    const track = input(101);
    track.points[55].gapBefore = true;
    const changed = reshapeInputHandle(
      track,
      50,
      { lat: track.points[50].lat, lon: -5.9999 },
      [0, 50, 100],
    );
    expect(changed.points.slice(55)).toEqual(track.points.slice(55));
    expect(changed.points[54].lon).toBe(track.points[54].lon);
  });
  it("rejects moves with insufficient room to blend, preserving the original", () => {
    const track = input(3);
    expect(() =>
      reshapeInputHandle(
        track,
        1,
        { lat: track.points[1].lat, lon: -5.99 },
        [0, 1, 2],
      ),
    ).toThrow(/too large/);
    expect(track.points.every((p) => p.lon === -6)).toBe(true);
  });
});
