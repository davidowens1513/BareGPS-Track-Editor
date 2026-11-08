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
