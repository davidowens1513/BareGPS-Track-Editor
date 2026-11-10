import { describe, expect, it } from "vitest";
import { simplifyTrack, trackSegmentDeviation } from "../src/simplify";
import {
  inputHandleIndices,
  reshapeInputHandle,
  finishInputTerrain,
} from "../src/input-edit";
import {
  emptyWorkspace,
  MAX_INPUT_POINTS,
  parseGPX,
  validateWorkspace,
  type Track,
} from "../src/model";
const track = (count = 7001): Track => ({
  id: "original",
  name: "Dense",
  source: "dense.gpx",
  kind: "track",
  color: "#d32f2f",
  points: Array.from({ length: count }, (_, i) => ({
    lat: 53 + i * 0.00001,
    lon: -6,
    ele: 100,
    time: "2026-11-01T10:00:00Z",
  })),
});
function checkBound(original: Track, simplified: Track) {
  let previous = 0;
  for (let n = 1; n < simplified.points.length; n++) {
    const end = original.points.findIndex(
      (p, i) =>
        i > previous &&
        p.lat === simplified.points[n].lat &&
        p.lon === simplified.points[n].lon,
    );
    expect(end).toBeGreaterThan(previous);
    for (let i = previous + 1; i < end; i++)
      expect(
        trackSegmentDeviation(
          original.points[i],
          original.points[previous],
          original.points[end],
        ),
      ).toBeLessThanOrEqual(10.00001);
    previous = end;
  }
}
describe("simplification preview candidate", () => {
  it("targets ten handles/km, keeps original immutable and makes one handle per point", () => {
    const original = track(),
      before = structuredClone(original);
    const result = simplifyTrack(original);
    expect(result.track.points.length).toBeGreaterThan(70);
    expect(result.track.points.length).toBeLessThan(85);
    expect(result.maxDeviation).toBeLessThanOrEqual(10);
    expect(result.handlesPerKm).toBeCloseTo(10, 0);
    expect(result.track.id).not.toBe(original.id);
    expect(original).toEqual(before);
    const handles = inputHandleIndices(result.track, 20);
    expect(handles).toHaveLength(result.track.points.length);
    const moved = reshapeInputHandle(
      result.track,
      3,
      { ...result.track.points[3], lon: -5.999 },
      handles,
    );
    expect(
      moved.points.filter(
        (p, i) =>
          p.lat !== result.track.points[i].lat ||
          p.lon !== result.track.points[i].lon,
      ),
    ).toHaveLength(1);
    expect(result.track.terrainNeedsRefresh).toBe(true);
    expect(result.track.points.every((p) => p.time === undefined)).toBe(true);
    checkBound(original, result.track);
  });
  it("retains tight bends rather than exceeding ten metres to meet the density", () => {
    const original = track(150);
    original.points.forEach((p, i) => {
      p.lat = 53 + i * 0.00001;
      p.lon = -6 + (i % 2) * 0.0005;
    });
    const result = simplifyTrack(original);
    expect(result.track.points.length).toBeGreaterThan(100);
    expect(result.maxDeviation).toBeLessThanOrEqual(10);
    checkBound(original, result.track);
  });
  it("protects names, gap endpoints and a closed loop", () => {
    const original = track(301);
    original.points[41].name = "Gate";
    original.points[120].gapBefore = true;
    const result = simplifyTrack(original);
    for (const index of [0, 41, 119, 120, 300])
      expect(
        result.track.points.some(
          (p) =>
            p.lat === original.points[index].lat &&
            p.lon === original.points[index].lon,
        ),
      ).toBe(true);
    expect(result.track.points.some((p) => p.gapBefore)).toBe(true);
    const closed = track(100);
    closed.points.push({ ...closed.points[0] });
    const loop = simplifyTrack(closed).track;
    expect(loop.points[0].lat).toBe(loop.points.at(-1)!.lat);
    expect(loop.points.length).toBeGreaterThan(2);
  });
  it("handles identical points, antimeridian crossings and polar coordinates", () => {
    const original = track(100);
    original.points.forEach((p) => {
      p.lat = 53;
      p.lon = -6;
    });
    expect(simplifyTrack(original).track.points).toHaveLength(2);
    expect(
      trackSegmentDeviation(
        { lat: 0, lon: 180 },
        { lat: 0, lon: 179 },
        { lat: 0, lon: -179 },
      ),
    ).toBeLessThan(0.001);
    expect(
      trackSegmentDeviation(
        { lat: 89, lon: 0 },
        { lat: 89, lon: -1 },
        { lat: 89, lon: 1 },
      ),
    ).toBeGreaterThan(0);
  });
  it("can import and restore a dense original while the normal plan limit stays smaller", () => {
    const points = '<trkpt lat="53" lon="-6"/>'.repeat(7001);
    const xml = `<gpx><trk><trkseg>${points}</trkseg></trk></gpx>`;
    expect(() => parseGPX(xml, "dense.gpx")).toThrow("5,000");
    const original = parseGPX(xml, "dense.gpx", 0, MAX_INPUT_POINTS)[0];
    const copy = simplifyTrack(original).track;
    expect(
      validateWorkspace({
        ...emptyWorkspace(),
        tracks: [original, copy],
        activeId: copy.id,
      }),
    ).toBe(true);
    expect(
      validateWorkspace({
        ...emptyWorkspace(),
        route: { ...original, kind: "route" },
      }),
    ).toBe(false);
  });
});

it("clears a simplified copy's refresh flag when terrain completes", () => {
  const original = simplifyTrack(track()).track;
  const sampled = {
    ...original,
    points: original.points.map((p, inputOriginalIndex) => ({
      ...p,
      inputOriginalIndex,
      terrain: true,
    })),
  };
  const refreshed = finishInputTerrain(original, sampled);
  expect(refreshed.terrainNeedsRefresh).toBe(false);
  expect(refreshed.simplified).toBe(true);
  expect(refreshed.points.some((p) => p.terrainPending)).toBe(false);
});
