import { it, expect } from "vitest";
import { findJoinReview, reversePlanCopies } from "../src/join-review";
import { emptyWorkspace, validateWorkspace, type Track } from "../src/model";
import { addPlanSection, buildPlannedRoute } from "../src/route-plan";
const track = (id: string, start: number, end: number): Track => ({
  id,
  name: id,
  source: id + ".gpx",
  color: "#16724d",
  kind: "track",
  points: [
    { lat: start, lon: -6, ele: 100 },
    { lat: end, lon: -6, ele: 100 },
  ],
});
it("suggests reversing the next section when it joins finish-to-finish", () => {
  const plan = [track("first", 53, 53.02), track("next", 53.04, 53.02)];
  const review = findJoinReview(plan)!;
  expect(review.suggestion?.reverseIndexes).toEqual([1]);
  expect(review.gap).toBeGreaterThan(2000);
  expect(review.suggestion?.gap).toBe(0);
  expect(findJoinReview(plan, new Set([0]))).toBeNull();
});
it("can identify the first section, or both sections, as reversed", () => {
  expect(
    findJoinReview([track("first", 53.02, 53), track("next", 53.02, 53.04)])
      ?.suggestion?.reverseIndexes,
  ).toEqual([0]);
  expect(
    findJoinReview([track("first", 53, 53.02), track("next", 53.04, 53)])
      ?.suggestion?.reverseIndexes,
  ).toEqual([0, 1]);
});
it("leaves short and sensible joins alone", () => {
  expect(
    findJoinReview([track("first", 53, 53.02), track("next", 53.02, 53.04)]),
  ).toBeNull();
  expect(
    findJoinReview([track("first", 53, 53.002), track("next", 53.004, 53.002)]),
  ).toBeNull();
});
it("does not fix one join by creating a worse neighbouring connection", () => {
  const plan = [
    track("first", 53, 53.02),
    track("next", 53.04, 53.02),
    track("last", 53.02, 53.04),
  ];
  // Reversing the middle section saves one join but adds the same distance to the next.
  expect(findJoinReview(plan)).toBeNull();
});
it("asks about a very long join even when reversal offers no clear improvement", () => {
  const result = findJoinReview([
    track("first", 53, 53.001),
    track("next", 54, 54.001),
  ]);
  expect(result?.gap).toBeGreaterThan(100000);
  expect(result?.suggestion).toBeNull();
});
it("reverses only saved copies, gives them new identities, and validates after reload", () => {
  const input = track("source", 53.04, 53.02);
  const plan = addPlanSection([], input);
  const before = structuredClone(plan);
  const reversed = reversePlanCopies(plan, [0]);
  expect(plan).toEqual(before);
  expect(input.points[0].lat).toBe(53.04);
  expect(reversed[0].points[0].lat).toBe(53.02);
  expect(reversed[0].id).not.toBe(plan[0].id);
  expect(reversed[0].inputTrackId).toBe(input.id);
  expect(reversed[0].planReversed).toBe(true);
  expect(reversePlanCopies(reversed, [0])[0].planReversed).toBe(false);
  const workspace = {
    ...emptyWorkspace(),
    tracks: [input],
    routePlan: reversed,
    route: buildPlannedRoute(reversed),
  };
  expect(validateWorkspace(JSON.parse(JSON.stringify(workspace)))).toBe(true);
  expect(
    validateWorkspace({
      ...workspace,
      routePlan: [{ ...reversed[0], planReversed: "bad" }],
    }),
  ).toBe(false);
  expect(() => reversePlanCopies(plan, [2])).toThrow(/changed/);
});
