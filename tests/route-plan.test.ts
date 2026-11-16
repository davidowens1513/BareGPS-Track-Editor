import { describe, it, expect } from "vitest";
import {
  addPlanSection,
  movePlanSection,
  buildPlannedRoute,
  MAX_PLAN_SECTIONS,
  allInputsInPlan,
  replacePlanSection,
  planCopyStatus,
} from "../src/route-plan";
import { reversePlanCopies } from "../src/join-review";
import {
  emptyWorkspace,
  validateWorkspace,
  restoreSeparateWorkspace,
  type Track,
} from "../src/model";
const input = (id = "input", latitude = 53): Track => ({
  id,
  name: id,
  source: id + ".gpx",
  color: "#d32f2f",
  kind: "track",
  points: Array.from({ length: 4 }, (_, i) => ({
    lat: latitude + i * 0.001,
    lon: -6,
    ele: 100 + i * 10,
    name: "P" + i,
  })),
});
describe("intermediate Route Plan", () => {
  it("retains a reversed plan direction through replacement and reload, using refreshed input data", () => {
    const source = input();
    source.points.forEach((point, index) => {
      point.time = `2026-11-16T09:0${index}:00Z`;
    });
    const plan = reversePlanCopies(addPlanSection([], source), [0]);
    const confirmed = buildPlannedRoute(plan);
    const refreshed = structuredClone(source);
    refreshed.points[2].ele = 350;
    const original = structuredClone(refreshed);
    expect(planCopyStatus(plan[0], [refreshed])).toBe("Input changed");
    const reloaded = JSON.parse(JSON.stringify(plan));
    const replacement = replacePlanSection(reloaded, 0, refreshed, {
      start: 0,
      end: 3,
    });
    expect(replacement[0].planReversed).toBe(true);
    expect(replacement[0].points.map((point) => point.name)).toEqual([
      "P3",
      "P2",
      "P1",
      "P0",
    ]);
    expect(replacement[0].points[1].ele).toBe(350);
    expect(
      replacement[0].points.every((point) => point.time === undefined),
    ).toBe(true);
    expect(replacement[0].id).not.toBe(plan[0].id);
    expect(planCopyStatus(replacement[0], [refreshed])).toBe("Current copy");
    expect(refreshed).toEqual(original);
    expect(confirmed.points[1].ele).toBe(120);
    expect(buildPlannedRoute(replacement, confirmed).points[1].ele).toBe(350);
    const again = replacePlanSection(
      JSON.parse(JSON.stringify(replacement)),
      0,
      refreshed,
      { start: 1, end: 3 },
    );
    expect(again[0].points.map((point) => point.name)).toEqual([
      "P3",
      "P2",
      "P1",
    ]);
    expect(again[0].planReversed).toBe(true);
  });
  it("keeps an ordinary or twice-reversed entry in input order, retaining recorded times", () => {
    const source = input();
    source.points[0].time = "2026-11-16T09:00:00Z";
    const plan = addPlanSection([], source);
    for (const entries of [
      plan,
      reversePlanCopies(reversePlanCopies(plan, [0]), [0]),
    ]) {
      const replacement = replacePlanSection(entries, 0, source, {
        start: 0,
        end: 3,
      });
      expect(replacement[0].points).toEqual(source.points);
      expect(replacement[0].planReversed).toBeFalsy();
    }
  });
  it("copies the current A–B section and isolates it from later input edits", () => {
    const track = input();
    const plan = addPlanSection([], track, { start: 1, end: 3 });
    expect(plan[0].name).toContain("points 2–4");
    expect(plan[0].points).toEqual(track.points.slice(1));
    track.points[1].lat = 0;
    track.points[1].name = "changed";
    expect(plan[0].points[0].lat).toBe(53.001);
    expect(plan[0].points[0].name).toBe("P1");
  });
  it("moves sections without changing an existing route, then builds only in the requested order", () => {
    let plan = addPlanSection([], input("first"), { start: 0, end: 3 });
    plan = addPlanSection(plan, input("second", 54), { start: 0, end: 3 });
    const firstOrder = buildPlannedRoute(plan);
    const moved = movePlanSection(plan, 1, 0);
    expect(plan[0].name).toContain("first");
    expect(firstOrder.points[0].lat).toBe(53);
    const confirmed = buildPlannedRoute(moved, {
      ...firstOrder,
      name: "Custom name",
      color: "#2563eb",
    });
    expect(confirmed.points[0].lat).toBe(54);
    expect(confirmed.points[4].gapBefore).toBe(true);
    expect(confirmed.id).toBe(firstOrder.id);
    expect(confirmed.name).toBe("Custom name");
    expect(confirmed.color).toBe("#2563eb");
    expect(buildPlannedRoute(plan).color).toBe("#16724d");
  });
  it("rejects empty confirmations, invalid movements and overflowing plans", () => {
    expect(() => buildPlannedRoute([])).toThrow();
    expect(() => movePlanSection([input()], 0, 1)).toThrow();
    expect(() =>
      addPlanSection(
        Array.from({ length: MAX_PLAN_SECTIONS }, () => input()),
        input(),
        { start: 0, end: 1 },
      ),
    ).toThrow(/500/);
    const large = {
      ...input(),
      points: Array.from({ length: 5000 }, () => ({ lat: 53, lon: -6 })),
    };
    expect(() =>
      addPlanSection([large], input(), { start: 0, end: 1 }),
    ).toThrow(/5,000/);
  });
  it("validates persisted plans and rejects malformed plan data", () => {
    const plan = addPlanSection([], input(), { start: 0, end: 3 });
    const workspace = {
      ...emptyWorkspace(),
      routePlan: plan,
      confirmedPlan: [plan[0].id],
    };
    expect(validateWorkspace(workspace)).toBe(true);
    expect(validateWorkspace({ ...workspace, routePlan: {} })).toBe(false);
    expect(
      validateWorkspace({
        ...workspace,
        routePlan: [{ ...plan[0], color: "bad" }],
      }),
    ).toBe(false);
    expect(validateWorkspace({ ...workspace, confirmedPlan: [5] })).toBe(false);
  });
  it("retains a legacy joined route as a confirmed plan entry on recovery", () => {
    const route = { ...input("oldroute"), kind: "route" as const };
    const restored = restoreSeparateWorkspace({ ...emptyWorkspace(), route });
    expect(restored.route).toEqual(route);
    expect(restored.routePlan?.[0].points).toEqual(route.points);
    expect(restored.confirmedPlan).toEqual([restored.routePlan![0].id]);
  });
});

it("recovers a full legacy workspace while reserving capacity for its copied plan", () => {
  const points = Array.from({ length: 5000 }, () => ({ lat: 53, lon: -6 }));
  const route = { ...input("legacy-route"), points, kind: "route" as const };
  const workspace = {
    ...emptyWorkspace(),
    tracks: [
      { ...input("source-one"), points },
      { ...input("source-two"), points },
    ],
    route,
  };
  expect(validateWorkspace(workspace)).toBe(true);
  const restored = restoreSeparateWorkspace(workspace);
  expect(restored.routePlan![0].points).toHaveLength(5000);
  expect(validateWorkspace(restored)).toBe(true);
});

it("uses Edited Route by default and migrates the old default without changing custom names", () => {
  const route = buildPlannedRoute([input()]);
  expect(route.name).toBe("Edited Route");
  expect(
    restoreSeparateWorkspace({
      ...emptyWorkspace(),
      route: { ...route, name: "My joined route" },
    }).route?.name,
  ).toBe("Edited Route");
  expect(
    restoreSeparateWorkspace({
      ...emptyWorkspace(),
      route: { ...route, name: "My ridge walk" },
    }).route?.name,
  ).toBe("My ridge walk");
});

it("clears the input selection only when each listed input has contributed a section", () => {
  const first = input("first"),
    second = input("second", 54);
  let plan = addPlanSection([], first, { start: 1, end: 2 });
  expect(allInputsInPlan([first, second], plan)).toBe(false);
  plan = addPlanSection(plan, first, { start: 2, end: 3 });
  expect(allInputsInPlan([first, second], plan)).toBe(false);
  plan = addPlanSection(plan, second, { start: 0, end: 1 });
  expect(allInputsInPlan([first, second], plan)).toBe(true);
  second.name = "Renamed input";
  expect(allInputsInPlan([first, second], plan)).toBe(true);
  expect(allInputsInPlan([], plan)).toBe(false);
  expect(allInputsInPlan([first, second, input("third")], plan)).toBe(false);
  const legacy = plan.map(({ inputTrackId, ...entry }) => entry);
  expect(allInputsInPlan([first], legacy)).toBe(true);
});
