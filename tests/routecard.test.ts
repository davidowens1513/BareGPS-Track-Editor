import { it, expect } from "vitest";
import { routecardText, routecardRows } from "../src/routecard";
import { newCreatedRoute } from "../src/create";
it("formats named and unnamed points with coordinates, distances and available heights", () => {
  const route = {
    ...newCreatedRoute(),
    name: "Hill walk",
    points: [
      { lat: 53, lon: -6, name: "Gate & bridge", ele: 120 },
      { lat: 53.001, lon: -6 },
      { lat: 53.002, lon: -6, name: "Summit", ele: 240 },
    ],
  };
  const text = routecardText(route, "latlon");
  expect(text).toContain("Hill walk — Routecard");
  expect(text).toContain("Point 1 · Gate & bridge · Start");
  expect(text).toContain("Point 3 · Summit · End");
  expect(text).toContain("\nPoint 2\n");
  expect(text).toContain("Height: unavailable");
  expect(text).toContain("Height: 240 m");
  expect(text).toContain("Total: 0.22 km");
  expect(text).toContain("Coordinates: Lat/Long (WGS84)");
  expect(text).not.toContain("undefined");
});

it("sums terrain climbs within each leg and carries cumulative ascent", () => {
  const points = [
    { lat: 53, lon: -6, ele: 100 },
    { lat: 53.002, lon: -6, ele: 100 },
    { lat: 53.004, lon: -6, ele: 130 },
  ];
  const route = { ...newCreatedRoute(), points };
  const terrain = {
    ...route,
    points: [
      points[0],
      { lat: 53.001, lon: -6, ele: 160 },
      points[1],
      points[2],
    ],
  };
  const rows = routecardRows(route, terrain);
  expect(rows.map((r) => r.ascent)).toEqual([0, 60, 30]);
  expect(rows.map((r) => r.totalAscent)).toEqual([0, 60, 90]);
  expect(rows[2].total).toBeCloseTo(rows[1].distance + rows[2].distance);
  const missing = routecardRows({
    ...route,
    points: [points[0], { ...points[1], ele: undefined }, points[2]],
  });
  expect(missing[1].ascent).toBeUndefined();
  expect(missing[2].totalAscent).toBeUndefined();
});

it("summarises to 30 original checkpoints and aggregates the full winding route", () => {
  const route = {
    ...newCreatedRoute(),
    points: Array.from({ length: 200 }, (_, i) => ({
      lat: 53 + i * 0.00001,
      lon: -6 + (i % 2) * 0.001,
      ele: i % 2 ? 150 : 100,
      ...(i === 47 ? { name: "Gate" } : {}),
    })),
  };
  const before = structuredClone(route);
  const full = routecardRows(route, undefined, true);
  const summary = routecardRows(route);
  expect(summary).toHaveLength(30);
  expect(summary[0].index).toBe(0);
  expect(summary.at(-1)!.index).toBe(199);
  expect(summary.some((r) => r.index === 47)).toBe(true);
  expect(new Set(summary.map((r) => r.index)).size).toBe(30);
  expect(summary.at(-1)!.total).toBeCloseTo(full.at(-1)!.total);
  expect(summary.reduce((n, r) => n + r.distance, 0)).toBeCloseTo(
    full.at(-1)!.total,
  );
  expect(summary.reduce((n, r) => n + r.ascent!, 0)).toBe(
    full.at(-1)!.totalAscent,
  );
  for (let n = 1; n < summary.length; n++) {
    const previous = summary[n - 1].index,
      current = summary[n].index;
    expect(summary[n].ascent).toBe(
      full
        .slice(previous + 1, current + 1)
        .reduce((sum, r) => sum + r.ascent!, 0),
    );
  }
  expect(route).toEqual(before);
  const text = routecardText(route, "latlon");
  expect(text).toContain("30 checkpoints from 200 route points");
  expect(text).toContain("Point 48 · Gate");
  expect(text.match(/^Point /gm)).toHaveLength(30);
  expect(text).toContain("Point 200 · End");
  expect(
    routecardText(route, "latlon", undefined, 0, true).match(/^Point /gm),
  ).toHaveLength(200);
});

it("keeps every named point even when names take the summary above 30", () => {
  const route = {
    ...newCreatedRoute(),
    points: Array.from({ length: 70 }, (_, i) => ({
      lat: 53,
      lon: -6,
      ...(i % 2 ? { name: `P${i}` } : {}),
    })),
  };
  const rows = routecardRows(route);
  expect(rows.length).toBeGreaterThan(30);
  expect(rows.filter((r) => r.point.name)).toHaveLength(35);
  expect(rows[0].index).toBe(0);
  expect(rows.at(-1)!.index).toBe(69);
});

it("handles coincident points and preserves missing ascent across omitted rows", () => {
  const route = {
    ...newCreatedRoute(),
    points: Array.from({ length: 100 }, (_, i) => ({
      lat: 53,
      lon: -6,
      ...(i !== 51 ? { ele: 100 } : {}),
    })),
  };
  const rows = routecardRows(route);
  expect(rows).toHaveLength(30);
  expect(rows.at(-1)!.total).toBe(0);
  expect(rows.some((r) => r.ascent === undefined)).toBe(true);
  expect(rows.at(-1)!.totalAscent).toBeUndefined();
  expect(routecardRows({ ...route, points: [] })).toEqual([]);
});
