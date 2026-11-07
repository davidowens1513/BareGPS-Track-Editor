import { describe, it, expect, vi } from "vitest";
import {
  newCreatedRoute,
  insertWaypoint,
  moveWaypoint,
  removeWaypoint,
  MAX_WAYPOINTS,
} from "../src/create";
import {
  analytics,
  emptyWorkspace,
  validateWorkspace,
  exportGPX,
  parseGPX,
} from "../src/model";
import { enrichTerrain, sampleGaps } from "../src/terrain";
const a = { lat: 53.01, lon: -6.33 },
  b = { lat: 53.012, lon: -6.328 },
  mid = { lat: 53.011, lon: -6.329 };
function route() {
  return insertWaypoint(insertWaypoint(newCreatedRoute(), 0, a), 1, b);
}
describe("created walking routes", () => {
  it("inserts a point between its neighbours and exports that walking order", () => {
    const original = route(),
      inserted = insertWaypoint(original, 1, mid);
    expect(inserted.points).toEqual([a, mid, b]);
    expect(original.points).toEqual([a, b]);
    expect(analytics(inserted.points).length).toBeGreaterThan(200);
    expect(
      parseGPX(exportGPX(inserted), "route.gpx")[0].points.map(
        ({ lat, lon }) => ({ lat, lon }),
      ),
    ).toEqual([a, mid, b]);
  });
  it("moves/removes points without mutating the source and discards stale heights", () => {
    const original = route();
    original.points[0].ele = 100;
    original.points[1].ele = 150;
    const moved = moveWaypoint(original, 1, mid);
    expect(moved.points).toEqual([a, mid]);
    expect(original.points[1]).toEqual({ ...b, ele: 150 });
    expect(removeWaypoint(moved, 0).points).toEqual([mid]);
    expect(removeWaypoint(removeWaypoint(moved, 0), 0).points).toEqual([]);
    expect(analytics(moved.points).missingEdges).toBe(1);
  });
  it("rejects invalid coordinates, obsolete indices, duplicates and excessive point counts", () => {
    const r = route();
    expect(() => insertWaypoint(r, 1, { lat: NaN, lon: 0 })).toThrow(
      "supported area",
    );
    expect(() => moveWaypoint(r, 0, { lat: 86, lon: 0 })).toThrow(
      "supported area",
    );
    expect(() => insertWaypoint(r, 7, mid)).toThrow("segment has changed");
    expect(() => moveWaypoint(r, 9, mid)).toThrow("no longer exists");
    expect(() => insertWaypoint(r, 1, a)).toThrow("too close");
    expect(() => moveWaypoint(r, 1, a)).toThrow("space");
    r.points = Array.from({ length: MAX_WAYPOINTS }, () => a);
    expect(() => insertWaypoint(r, 0, b)).toThrow("1,000");
  });
  it("restores old workspaces plus empty, one-point and complete creation drafts", () => {
    const w = emptyWorkspace();
    expect(validateWorkspace(w)).toBe(true);
    w.created = newCreatedRoute();
    expect(validateWorkspace(w)).toBe(true);
    w.created = insertWaypoint(w.created, 0, a);
    expect(validateWorkspace(w)).toBe(true);
    w.created = route();
    expect(validateWorkspace(w)).toBe(true);
    w.created.points[0].lat = Infinity;
    expect(validateWorkspace(w)).toBe(false);
  });
  it("samples terrain along every created leg, including intermediate hills", async () => {
    const original = route();
    const mock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => {
        const url = new URL(String(input), "http://localhost");
        const count = url.searchParams.get("locations")!.split("|").length;
        return new Response(
          JSON.stringify({
            status: "OK",
            results: Array.from({ length: count }, (_, i) => ({
              elevation: i === 0 ? 200 : 100,
            })),
          }),
        );
      });
    try {
      const sampled = await enrichTerrain(
        {
          ...original,
          points: original.points.map((p, i) => ({ ...p, gapBefore: i > 0 })),
        },
        () => {},
        new AbortController().signal,
      );
      expect(sampled.points.length).toBeGreaterThan(2);
      expect(analytics(sampled.points).ascent).toBeGreaterThan(0);
      expect(analytics(sampled.points).missingEdges).toBe(0);
      expect(original.points).toEqual([a, b]);
    } finally {
      mock.mockRestore();
    }
  });
});

import { routeTapIndex, closeRoute, isClosedRoute } from "../src/create";
describe("circular route drawing", () => {
  const c = { lat: 53.013, lon: -6.331 };
  const triangle = () => insertWaypoint(route(), 2, c);
  it("extends the return leg even when a tap hits an outgoing segment in Add points", () => {
    const r = triangle(),
      index = routeTapIndex("add", r.points.length, 1)!;
    expect(insertWaypoint(r, index, mid).points).toEqual([a, b, c, mid]);
  });
  it("inserts only into a chosen segment in Insert point mode", () => {
    const r = triangle();
    expect(routeTapIndex("insert", r.points.length)).toBeNull();
    expect(routeTapIndex("insert", r.points.length, 0)).toBeNull();
    expect(routeTapIndex("insert", r.points.length, 3)).toBeNull();
    expect(
      insertWaypoint(r, routeTapIndex("insert", r.points.length, 1)!, mid)
        .points,
    ).toEqual([a, mid, b, c]);
  });
  it("closes exactly at the start, counts the closing leg, and round-trips through GPX", () => {
    const original = triangle(),
      closed = closeRoute(original);
    expect(closed.points).toEqual([a, b, c, a]);
    expect(original.points).toHaveLength(3);
    expect(isClosedRoute(closed)).toBe(true);
    expect(analytics(closed.points).length).toBeGreaterThan(
      analytics(original.points).length,
    );
    expect(isClosedRoute(parseGPX(exportGPX(closed), "loop.gpx")[0])).toBe(
      true,
    );
    expect(closeRoute(closed)).toBe(closed);
  });
  it("snaps a nearly closed endpoint instead of adding a duplicate point", () => {
    const r = triangle();
    r.points.push({ lat: a.lat + 0.0000001, lon: a.lon, ele: 99 });
    const closed = closeRoute(r);
    expect(closed.points).toHaveLength(4);
    expect(closed.points.at(-1)).toEqual(a);
    expect(closed.points.every((p) => p.ele === undefined)).toBe(true);
  });
  it("rejects too few points and obeys the waypoint limit when closing", () => {
    expect(() => closeRoute(route())).toThrow("at least three");
    const r = triangle();
    r.points = Array.from({ length: MAX_WAYPOINTS }, (_, i) =>
      i === 0 ? a : b,
    );
    expect(() => closeRoute(r)).toThrow("1,000");
  });
});

it("keeps optional point names through route changes and GPX export", () => {
  const original = route();
  original.points[0].name = 'Gate & <bridge> "west"';
  original.points[1].name = "Summit";
  const inserted = insertWaypoint(original, 1, mid);
  const moved = moveWaypoint(inserted, 2, { lat: 53.013, lon: -6.327 });
  const removed = removeWaypoint(moved, 1);
  expect(removed.points.map((p) => p.name)).toEqual([
    original.points[0].name,
    "Summit",
  ]);
  const restored = parseGPX(exportGPX(removed), "named.gpx")[0];
  expect(restored.points.map((p) => p.name)).toEqual(
    removed.points.map((p) => p.name),
  );
  const sampled = sampleGaps({
    ...removed,
    points: removed.points.map((p, i) => ({ ...p, gapBefore: i > 0 })),
  });
  expect(sampled.points.filter((p) => p.name).map((p) => p.name)).toEqual(
    removed.points.map((p) => p.name),
  );
});
