import { describe, it, expect } from "vitest";
import { toPoint } from "mgrs";
import {
  coordinateSystems,
  formatCoordinate,
  isCoordinateSystem,
} from "../src/coordinates";

describe("coordinate display", () => {
  it("keeps latitude first and longitude second", () => {
    expect(formatCoordinate({ lat: 51.99947, lon: -9.74269 }, "latlon")).toBe(
      "51.99947, -9.74269",
    );
  });
  it("projects the ITM origin", () => {
    expect(formatCoordinate({ lat: 53.5, lon: -8 }, "itm")).toBe(
      "E 600000 · N 750000",
    );
  });
  it("uses Irish grid square V around Carrauntoohil", () => {
    expect(formatCoordinate({ lat: 51.99947, lon: -9.74269 }, "irish")).toMatch(
      /^V \d{5} \d{5}$/,
    );
  });
  it("matches the OS worked-example point within Helmert accuracy", () => {
    const result = formatCoordinate(
      { lat: 52.6579786, lon: 1.7160519 },
      "british",
    );
    const [square, e, n] = result.split(" ");
    expect(square).toBe("TG");
    expect(Math.abs(Number(e) - 51409)).toBeLessThan(5);
    expect(Math.abs(Number(n) - 13177)).toBeLessThan(5);
  });
  it("includes UTM zone and hemisphere, including the southern false northing", () => {
    expect(formatCoordinate({ lat: 0, lon: 3 }, "utm")).toBe(
      "31N · E 500000 · N 0",
    );
    expect(formatCoordinate({ lat: -45, lon: 3 }, "utm")).toBe(
      "31S · E 500000 · N 5017050",
    );
  });
  it("handles Norway, Svalbard and the date line", () => {
    for (const [lat, lon, zone] of [
      [60, 6, 32],
      [78, 20, 33],
      [0, 180, 60],
      [0, -180, 1],
    ]) {
      expect(formatCoordinate({ lat, lon }, "utm")).toMatch(
        new RegExp(`^${zone}N ·`),
      );
    }
  });
  it("formats full MGRS and WGS84 USNG references without losing their location", () => {
    const point = { lat: 38.8977, lon: -77.0365 };
    const text = formatCoordinate(point, "mgrs");
    expect(text).toBe("18S UJ 23394 07395");
    expect(formatCoordinate(point, "usng")).toBe(text);
    const [lon, lat] = toPoint(text.replaceAll(" ", ""));
    expect(Math.abs(lat - point.lat)).toBeLessThan(0.00002);
    expect(Math.abs(lon - point.lon)).toBeLessThan(0.00002);
  });
  it("rejects invalid values and out-of-coverage positions", () => {
    expect(formatCoordinate({ lat: NaN, lon: 0 }, "utm")).toBe(
      "Invalid coordinates",
    );
    expect(formatCoordinate({ lat: 91, lon: 0 }, "latlon")).toBe(
      "Invalid coordinates",
    );
    expect(formatCoordinate({ lat: 38, lon: -77 }, "irish")).toContain(
      "Outside Irish",
    );
    expect(formatCoordinate({ lat: 38, lon: -77 }, "itm")).toContain(
      "Outside Irish",
    );
    expect(formatCoordinate({ lat: 38, lon: -77 }, "british")).toContain(
      "Outside British",
    );
    for (const system of ["utm", "mgrs", "usng"] as const)
      expect(formatCoordinate({ lat: 85, lon: 0 }, system)).toContain(
        "Outside",
      );
  });
  it("accepts only known saved settings", () => {
    expect(Object.keys(coordinateSystems).every(isCoordinateSystem)).toBe(true);
    for (const value of [null, {}, "constructor", "toString", "unknown"])
      expect(isCoordinateSystem(value)).toBe(false);
  });
});
