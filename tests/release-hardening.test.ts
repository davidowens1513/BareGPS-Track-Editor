import { it, expect } from "vitest";
import { assessElevation } from "../src/elevation";
import { routecardRows, routecardText } from "../src/routecard";
import {
  addPlanSection,
  buildPlannedRoute,
  planCopyStatus,
  planSignature,
  confirmedRouteChanged,
  replacePlanSection,
} from "../src/route-plan";
import { emptyWorkspace, validateWorkspace, type Track } from "../src/model";
const track = (): Track => ({
  id: "input",
  name: "Wicklow loop",
  source: "walk.gpx",
  kind: "track",
  color: "#16724d",
  points: [
    { lat: 53, lon: -6, ele: 100 },
    { lat: 53.001, lon: -6, ele: 120 },
    { lat: 53.002, lon: -6, ele: 180 },
  ],
});
it("withholds incomplete or stale ascent in totals and all Route Card exports", () => {
  for (const t of [
    { ...track(), terrainNeedsRefresh: true },
    {
      ...track(),
      points: track().points.map((p, i) =>
        i === 1 ? { ...p, ele: undefined } : p,
      ),
    },
    {
      ...track(),
      points: track().points.map((p, i) =>
        i === 1 ? { ...p, gapBefore: true } : p,
      ),
    },
    {
      ...track(),
      points: track().points.map((p, i) =>
        i === 1 ? { ...p, terrainPending: true } : p,
      ),
    },
  ]) {
    expect(assessElevation(t).ascent).toBeUndefined();
    expect(routecardRows(t).at(-1)!.totalAscent).toBeUndefined();
    expect(routecardText(t, "latlon")).toContain(
      "Cumulative ascent: unavailable",
    );
  }
  expect(assessElevation(track()).ascent).toBe(80);
  expect(routecardRows(track()).at(-1)!.totalAscent).toBe(80);
});
it("distinguishes changed inputs and plan changes, including duplicates, Undo and reload", () => {
  const input = track(),
    plan = addPlanSection(addPlanSection([], input), input);
  const w = {
    ...emptyWorkspace(),
    tracks: [input],
    routePlan: plan,
    route: buildPlannedRoute(plan),
    confirmedPlan: plan.map((t) => t.id),
    confirmedSignature: planSignature(plan),
  };
  expect(validateWorkspace(w)).toBe(true);
  expect(planCopyStatus(plan[0], [input])).toBe("Current copy");
  const renamed = { ...input, name: "New walk name" };
  expect(planCopyStatus(plan[0], [renamed])).toBe("Input changed");
  expect(confirmedRouteChanged(w)).toBe(false);
  const changed = {
    ...w,
    routePlan: replacePlanSection(plan, 1, renamed, { start: 0, end: 2 }),
  };
  expect(planCopyStatus(changed.routePlan[0], [renamed])).toBe("Input changed");
  expect(planCopyStatus(changed.routePlan[1], [renamed])).toBe("Current copy");
  expect(confirmedRouteChanged(JSON.parse(JSON.stringify(changed)))).toBe(true);
  expect(confirmedRouteChanged(w)).toBe(false);
  expect(planCopyStatus(plan[0], [input])).toBe("Current copy");
});
it("carries stale terrain through route building instead of publishing an apparently complete ascent", () => {
  const plan = addPlanSection([], { ...track(), terrainNeedsRefresh: true });
  expect(assessElevation(buildPlannedRoute(plan)).ascent).toBeUndefined();
});
