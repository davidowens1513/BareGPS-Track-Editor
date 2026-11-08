import { join, MAX_POINTS, section, type Selection, type Track } from "./model";

export const MAX_PLAN_SECTIONS = 500;

export function addPlanSection(
  plan: Track[],
  input: Track,
  selection: Selection = { start: 0, end: input.points.length - 1 },
): Track[] {
  if (plan.length >= MAX_PLAN_SECTIONS)
    throw new Error(
      "The Route Plan can hold 500 sections. Remove a section before adding another.",
    );
  const snapshot = section(
    input,
    selection,
    selection.start === 0 && selection.end === input.points.length - 1
      ? input.name
      : `${input.name} · points ${selection.start + 1}–${selection.end + 1}`,
  );
  if (
    plan.reduce(
      (count, track) => count + track.points.length,
      snapshot.points.length,
    ) > MAX_POINTS
  )
    throw new Error(
      "The Route Plan is too large. Keep it below 150,000 points.",
    );
  return [...plan, { ...snapshot, inputTrackId: input.id }];
}

export function movePlanSection(
  plan: Track[],
  from: number,
  to: number,
): Track[] {
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 0 ||
    to < 0 ||
    from >= plan.length ||
    to >= plan.length
  )
    throw new Error("That Route Plan section has changed. Select it again.");
  const result = [...plan];
  result.splice(to, 0, result.splice(from, 1)[0]);
  return result;
}

export function buildPlannedRoute(
  plan: Track[],
  previous?: Track | null,
): Track {
  if (!plan.length)
    throw new Error("Add at least one section to the Route Plan first.");
  let route: Track | null = null;
  for (const track of plan)
    route = join(route, track, { start: 0, end: track.points.length - 1 });
  return previous
    ? { ...route!, id: previous.id, name: previous.name, color: previous.color }
    : route!;
}

export function allInputsInPlan(inputs: Track[], plan: Track[]): boolean {
  return (
    inputs.length > 0 &&
    inputs.every((input) =>
      plan.some((entry) => {
        if (entry.inputTrackId) return entry.inputTrackId === input.id;
        // Recover coverage for sections staged before source IDs were stored.
        if (
          entry.source !== input.source ||
          !entry.name.startsWith(input.name + " · points ")
        )
          return false;
        const bounds = entry.name.match(/ · points (\d+)–(\d+)$/);
        if (!bounds) return false;
        const start = Number(bounds[1]) - 1,
          end = Number(bounds[2]) - 1;
        return (
          start >= 0 &&
          end < input.points.length &&
          entry.points.length === end - start + 1 &&
          entry.points.every(
            (point, i) =>
              point.lat === input.points[start + i]?.lat &&
              point.lon === input.points[start + i]?.lon,
          )
        );
      }),
    )
  );
}

export function replacePlanSection(
  plan: Track[],
  index: number,
  input: Track,
  selection: Selection,
): Track[] {
  if (!Number.isInteger(index) || index < 0 || index >= plan.length)
    throw new Error("Select a planned section to replace.");
  const result = [...plan];
  result[index] = addPlanSection([], input, selection)[0];
  if (
    result.reduce((count, track) => count + track.points.length, 0) > MAX_POINTS
  )
    throw new Error(
      "The Route Plan is too large. Keep it below 150,000 points.",
    );
  return result;
}
