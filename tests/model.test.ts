import { describe, it, expect } from "vitest";
import {
  analytics,
  distance,
  emptyWorkspace,
  exportGPX,
  join,
  parseGPX,
  reverse,
  section,
  split,
  validateWorkspace,
  type Track,
} from "../src/model";
import { sampleGaps, enrichTerrain } from "../src/terrain";
const track = (): Track => ({
  id: "t",
  name: "Hill & valley <route>",
  source: "test.gpx",
  kind: "track",
  color: "#278aa2",
  points: [
    { lat: 56, lon: -5, ele: 100 },
    { lat: 56.001, lon: -5, ele: 120 },
    { lat: 56.002, lon: -5, ele: 110 },
    { lat: 56.003, lon: -5, ele: 150 },
    { lat: 56.004, lon: -5, ele: 130 },
  ],
});
const gpx = (body: string) =>
  `<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1">${body}</gpx>`;
describe("track editing and walking totals", () => {
  it("measures geodesic distance and sums every rise and fall", () => {
    const a = analytics(track().points);
    expect(a.length).toBeCloseTo(444.78, 1);
    expect(a.ascent).toBe(60);
    expect(a.descent).toBe(30);
  });
  it("counts a disconnected join in both walking distance and ascent", () => {
    const t = track();
    const next = {
      ...track(),
      points: [
        { lat: 56.01, lon: -5, ele: 180 },
        { lat: 56.011, lon: -5, ele: 200 },
      ],
    };
    const first = join(null, t, { start: 1, end: 3 });
    const joined = join(first, next, { start: 0, end: 1 });
    const a = analytics(joined.points);
    expect(joined.points[3].gapBefore).toBe(true);
    expect(a.length).toBeCloseTo(distance(t.points[1], next.points[1]), 3);
    expect(a.ascent).toBe(90);
    expect(a.gapDistance).toBeGreaterThan(700);
    expect(a.estimatedGap).toBe(true);
    expect(t.points[0].gapBefore).toBeUndefined();
  });
  it("does not create a gap when sections share their endpoint", () => {
    const t = track();
    const joined = join(join(null, t, { start: 0, end: 2 }), t, {
      start: 2,
      end: 4,
    });
    expect(joined.points).toHaveLength(5);
    expect(analytics(joined.points).gapDistance).toBe(0);
    expect(analytics(joined.points).ascent).toBe(60);
  });
  it("trims and splits without changing the source and shares the cut point", () => {
    const t = track(),
      copy = structuredClone(t);
    const selected = section(t, { start: 1, end: 4 });
    const [a, b] = split(selected, 1);
    expect(a.points).toHaveLength(2);
    expect(b.points).toHaveLength(3);
    expect(a.points.at(-1)).toEqual(b.points[0]);
    expect(analytics(a.points).length + analytics(b.points).length).toBeCloseTo(
      analytics(selected.points).length,
      8,
    );
    expect(t).toEqual(copy);
    expect(() => split(t, 0)).toThrow();
  });
  it("reverses gap edge markers and swaps ascent/descent", () => {
    const t = track();
    t.points[2].gapBefore = true;
    t.points[2].terrain = true;
    const r = reverse(t);
    expect(r.points[3].gapBefore).toBe(true);
    expect(r.points[3].terrain).toBe(true);
    expect(r.points[0].gapBefore).toBeUndefined();
    expect(analytics(r.points).ascent).toBe(30);
    expect(analytics(r.points).descent).toBe(60);
    expect(analytics(r.points).gapDistance).toBeCloseTo(
      analytics(t.points).gapDistance,
      8,
    );
  });
  it("reports partial ascent when elevation is missing, while retaining full distance", () => {
    const t = track();
    delete t.points[2].ele;
    const a = analytics(t.points);
    expect(a.missingEdges).toBe(2);
    expect(a.length).toBeCloseTo(444.78, 1);
    expect(a.ascent).toBe(20);
  });
  it("handles the maximum supported point count without argument-stack overflow", () => {
    const points = Array.from({ length: 150000 }, (_, i) => ({
      lat: 50,
      lon: i / 100000,
      ele: i % 100,
    }));
    expect(analytics(points).min).toBe(0);
    expect(analytics(points).max).toBe(99);
  });
});
describe("GPX integrity and input errors", () => {
  it("round-trips names, colour, elevations, times and dashed connections", () => {
    const t = track();
    t.points[2].gapBefore = true;
    t.points[2].terrain = true;
    t.points[0].time = "2026-01-01T12:00:00Z";
    const [result] = parseGPX(exportGPX(t), "roundtrip.gpx");
    expect(result.name).toBe(t.name);
    expect(result.color).toBe(t.color);
    expect(result.points).toEqual(t.points);
    expect(analytics(result.points)).toEqual(analytics(t.points));
  });
  it("reads multiple tracks, namespaces, GPX routes and segment gaps", () => {
    const tracks = parseGPX(
      gpx(
        '<trk><name>One</name><trkseg><trkpt lat="0" lon="0"><ele>0</ele></trkpt><trkpt lat="0" lon="1"/></trkseg><trkseg><trkpt lat="0" lon="2"/><trkpt lat="0" lon="3"/></trkseg></trk><rte><name>Two</name><rtept lat="1" lon="1"/><rtept lat="2" lon="2"/></rte>',
      ),
      "multiple.gpx",
    );
    expect(tracks).toHaveLength(2);
    expect(tracks[0].points[0].ele).toBe(0);
    expect(tracks[0].points[2].gapBefore).toBe(true);
    expect(analytics(tracks[0].points).length).toBeGreaterThan(333000);
    expect(tracks[1].name).toBe("Two");
  });
  it.each([
    "garbage",
    "<gpx><broken>",
    "<html></html>",
    gpx('<wpt lat="1" lon="2"/>'),
    gpx(
      '<trk><trkseg><trkpt lat="91" lon="0"/><trkpt lat="1" lon="1"/></trkseg></trk>',
    ),
    gpx(
      '<trk><trkseg><trkpt lat="" lon="0"/><trkpt lat="1" lon="1"/></trkseg></trk>',
    ),
    gpx(
      '<rte><rtept lat="1" lon="1"><ele>NaN</ele></rtept><rtept lat="2" lon="2"/></rte>',
    ),
    '<!DOCTYPE gpx [<!ENTITY a "boom">]><gpx/>',
  ])(
    "rejects invalid/empty/unsafe files without producing partial tracks: %s",
    (xml) => {
      expect(() => parseGPX(xml, "bad.gpx")).toThrow();
    },
  );
  it("validates saved workspaces before restoring", () => {
    const w = emptyWorkspace();
    w.tracks = [track()];
    w.activeId = "t";
    expect(validateWorkspace(w)).toBe(true);
    expect(
      validateWorkspace({
        ...w,
        tracks: [{ ...track(), color: '\" onload=alert(1)' }],
      }),
    ).toBe(false);
    expect(
      validateWorkspace({
        ...w,
        tracks: [
          {
            ...track(),
            points: [
              { lat: NaN, lon: 0 },
              { lat: 0, lon: 0 },
            ],
          },
        ],
      }),
    ).toBe(false);
    expect(validateWorkspace({ ...w, activeId: "missing" })).toBe(false);
  });
});
describe("terrain sampling", () => {
  it("samples the entire connection without changing the original track", () => {
    const t = track();
    t.points[3].gapBefore = true;
    const sampled = sampleGaps(t);
    expect(sampled.points.length).toBeGreaterThan(t.points.length);
    expect(t.points.length).toBe(5);
    expect(analytics(sampled.points).length).toBeCloseTo(
      analytics(t.points).length,
      1,
    );
    const samples = sampled.points.filter((p) => p.gapBefore);
    expect(
      samples.every((p, i) => i === 0 || distance(samples[i - 1], p) <= 91),
    ).toBe(true);
  });
  it("uses intermediate terrain gains rather than only endpoint elevation", async () => {
    const t = track();
    t.points = [
      { lat: 56, lon: -5, ele: 100 },
      { lat: 56.003, lon: -5, ele: 100, gapBefore: true },
    ];
    const original = structuredClone(t);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "OK",
          results: [
            { elevation: 140 },
            { elevation: 180 },
            { elevation: 140 },
            { elevation: 100 },
            { elevation: 100 },
          ],
        }),
        { status: 200 },
      ),
    );
    const result = await enrichTerrain(
      t,
      () => {},
      new AbortController().signal,
    );
    expect(analytics(result.points).ascent).toBe(80);
    expect(analytics(result.points).estimatedGap).toBe(false);
    expect(t).toEqual(original);
    fetchMock.mockRestore();
  });
  it("leaves source untouched if the service returns missing heights", async () => {
    const t = track();
    t.points[2].gapBefore = true;
    const original = structuredClone(t);
    const mock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ status: "OK", results: [] })),
      );
    await expect(
      enrichTerrain(t, () => {}, new AbortController().signal),
    ).rejects.toThrow("unavailable");
    expect(t).toEqual(original);
    mock.mockRestore();
  });
});
import { vi } from "vitest";
