import { it, expect } from "vitest";
import { routecardText } from "../src/routecard";
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
