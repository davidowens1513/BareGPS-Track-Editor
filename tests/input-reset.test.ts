import { it, expect } from "vitest";
import {
  emptyWorkspace,
  reverse,
  validateWorkspace,
  exportGPX,
  type Track,
} from "../src/model";
import { rememberInputStarts, resetInputTrack } from "../src/input-reset";
import { addPlanSection, buildPlannedRoute } from "../src/route-plan";
const original = (id = "input-one"): Track => ({
  id,
  name: "Original",
  color: "#ff0000",
  source: "original.gpx",
  kind: "track",
  points: [
    { lat: 53, lon: -6, ele: 100, time: "2026-11-12T10:00:00Z" },
    { lat: 53.001, lon: -6, ele: 120, name: "Gate" },
    { lat: 53.002, lon: -6, ele: 130 },
  ],
});
it("restores just the chosen input without aliasing the reset snapshot or plan copies", () => {
  const w = {
    ...emptyWorkspace(),
    tracks: [original(), original("input-two")],
  };
  rememberInputStarts(w);
  const baseline = structuredClone(w.inputOriginals);
  w.routePlan = addPlanSection([], w.tracks[0]);
  w.route = buildPlannedRoute(w.routePlan);
  const plan = structuredClone(w.routePlan),
    output = structuredClone(w.route);
  const other = w.tracks[1];
  w.tracks[0] = {
    ...reverse(w.tracks[0]),
    name: "Changed",
    color: "#0000ff",
    points: [w.tracks[0].points[1], w.tracks[0].points[2]],
  };
  rememberInputStarts(w);
  const beforeReset = structuredClone(w);
  w.tracks[0] = resetInputTrack(w, w.tracks[0].id);
  expect(w.tracks[0]).toEqual(original());
  expect(w.tracks[1]).toBe(other);
  expect(w.routePlan).toEqual(plan);
  expect(w.route).toEqual(output);
  expect(w.inputOriginals).toEqual(baseline);
  w.tracks[0].points[0].lat = 50;
  expect(w.inputOriginals![0].points[0].lat).toBe(53);
  expect(beforeReset.tracks[0].name).toBe("Changed");
});
it("survives a workspace save/reload and captures legacy workspaces only once", () => {
  const w = { ...emptyWorkspace(), tracks: [original()] };
  rememberInputStarts(w);
  w.tracks[0] = reverse(w.tracks[0]);
  const restored = JSON.parse(JSON.stringify(w));
  expect(validateWorkspace(restored)).toBe(true);
  rememberInputStarts(restored);
  expect(resetInputTrack(restored, "input-one")).toEqual(original());
  expect(exportGPX(restored.tracks[0])).not.toContain("inputOriginals");
});
it("prunes removed baselines, captures new simplified inputs, and rejects corrupt baselines", () => {
  const w = { ...emptyWorkspace(), tracks: [original()] };
  rememberInputStarts(w);
  w.tracks = [{ ...original("simplified"), simplified: true }];
  rememberInputStarts(w);
  expect(w.inputOriginals!.map((t) => t.id)).toEqual(["simplified"]);
  expect(resetInputTrack(w, "simplified").simplified).toBe(true);
  expect(() => resetInputTrack(w, "missing")).toThrow();
  const broken = structuredClone(w);
  broken.inputOriginals![0].points[0].lat = NaN;
  expect(validateWorkspace(broken)).toBe(false);
  expect(
    validateWorkspace({ ...w, inputOriginals: [original("orphan")] }),
  ).toBe(false);
  expect(
    validateWorkspace({
      ...w,
      inputOriginals: [...w.inputOriginals!, ...w.inputOriginals!],
    }),
  ).toBe(false);
});
