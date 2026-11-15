import {
  join,
  MAX_POINTS,
  section,
  type Selection,
  type Track,
  type Workspace,
} from "./model";

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
      "The Route Plan is too large. Keep it at or below 5,000 points.",
    );
  return [
    ...plan,
    {
      ...snapshot,
      inputTrackId: input.id,
      inputSignature: trackSignature(input),
    },
  ];
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
  route = {
    ...route!,
    terrainNeedsRefresh: plan.some((t) => t.terrainNeedsRefresh),
  };
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
      "The Route Plan is too large. Keep it at or below 5,000 points.",
    );
  return result;
}

// Content identity survives save/reload and becomes current again after Undo.
export function trackSignature(track: Track): string {
  const text = JSON.stringify([
    track.name,
    track.points,
    !!track.terrainNeedsRefresh,
  ]);
  let a = 2166136261,
    b = 5381;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ text.charCodeAt(i);
  }
  return `${text.length}-${a >>> 0}-${b >>> 0}`;
}
export function planSignature(plan: Track[]): string {
  return plan.map((t) => `${t.id}:${trackSignature(t)}`).join("|");
}
export function planCopyStatus(entry: Track, inputs: Track[]): string {
  const input = inputs.find((t) => t.id === entry.inputTrackId);
  if (!input)
    return entry.inputTrackId ? "Input removed" : "Older copy — check input";
  if (!entry.inputSignature) return "Older copy — check input";
  return entry.inputSignature === trackSignature(input)
    ? "Current copy"
    : "Input changed";
}
export function confirmedRouteChanged(workspace: Workspace): boolean {
  if (!workspace.route) return false;
  return workspace.confirmedSignature !== undefined
    ? workspace.confirmedSignature !== planSignature(workspace.routePlan ?? [])
    : JSON.stringify(workspace.confirmedPlan ?? []) !==
        JSON.stringify((workspace.routePlan ?? []).map((t) => t.id));
}
