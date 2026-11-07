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
import { enrichTerrain } from "../src/terrain";
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
