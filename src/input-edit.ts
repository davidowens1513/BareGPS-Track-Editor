import { distance, MAX_POINTS, type Point, type Track } from "./model";
import { isClosedRoute } from "./create";

export type InputPointTool = "move" | "add" | "insert";
export const MAX_VISIBLE_INPUT_HANDLES = 200;

function validCoordinate(point: Point) {
  if (
    !Number.isFinite(point.lat) ||
    Math.abs(point.lat) > 85.05112878 ||
    !Number.isFinite(point.lon) ||
    Math.abs(point.lon) > 180
  )
    throw new Error("Choose a point within the map’s supported area.");
}
function validIndex(track: Track, index: number) {
  if (!Number.isInteger(index) || !track.points[index])
    throw new Error("That input point has changed. Select it again.");
}
export function inputHandleIndices(
  track: Track,
  interval: number,
  extra: Iterable<number> = [],
): number[] {
  if (!Number.isInteger(interval) || interval < 1 || interval > MAX_POINTS)
    throw new Error("Choose a handle interval between 1 and 150,000 points.");
  const indices = new Set<number>();
  for (let i = 0; i < track.points.length; i += interval) indices.add(i);
  if (track.points.length) indices.add(track.points.length - 1);
  track.points.forEach((point, i) => {
    if (i && point.gapBefore && !track.points[i - 1].gapBefore) {
      indices.add(i - 1);
      indices.add(i);
    }
    if (i && !point.gapBefore && track.points[i - 1].gapBefore)
      indices.add(i - 1);
  });
  for (const index of extra)
    if (Number.isInteger(index) && index >= 0 && index < track.points.length)
      indices.add(index);
  return [...indices].sort((a, b) => a - b);
}

export function insertInputPoint(
  track: Track,
  index: number,
  point: Point,
): Track {
  validCoordinate(point);
  if (!Number.isInteger(index) || index < 0 || index > track.points.length)
    throw new Error("That input segment has changed. Try again.");
  if (track.points.length >= MAX_POINTS)
    throw new Error("This input track has reached the 150,000 point limit.");
  if (
    [track.points[index - 1], track.points[index]].some(
      (neighbour) => neighbour && distance(neighbour, point) < 0.5,
    )
  )
    throw new Error(
      "Choose a point at least half a metre from its neighbours.",
    );
  const points = [...track.points];
  const gap = index > 0 && !!points[index]?.gapBefore;
  points.splice(index, 0, {
    lat: point.lat,
    lon: point.lon,
    name: point.name,
    gapBefore: gap || undefined,
    terrainPending: index > 0 || undefined,
  });
  if (points[index + 1])
    points[index + 1] = {
      ...points[index + 1],
      gapBefore: index === 0 ? undefined : points[index + 1].gapBefore,
      terrain: undefined,
      terrainPending: true,
    };
  return { ...track, points };
}

export function deleteInputPoint(track: Track, index: number): Track {
  validIndex(track, index);
  if (track.points.length <= 2)
    throw new Error("An input track must keep at least two points.");
  const removed = track.points[index];
  const points = track.points.filter((_, i) => i !== index);
  if (points[index])
    points[index] = {
      ...points[index],
      gapBefore: index
        ? removed.gapBefore || points[index].gapBefore || undefined
        : undefined,
      terrain: undefined,
      terrainPending: index > 0 || undefined,
    };
  return { ...track, points };
}

/** Taper displacement to zero at the adjacent handles, retaining every dense point. */
export function reshapeInputHandle(
  track: Track,
  index: number,
  target: Point,
  handles: number[],
): Track {
  validIndex(track, index);
  validCoordinate(target);
  const anchors = [
    ...new Set([...handles, 0, track.points.length - 1, index]),
  ].sort((a, b) => a - b);
  const closed =
    isClosedRoute(track) && (index === 0 || index === track.points.length - 1);
  const moving = closed ? [0, track.points.length - 1] : [index];
  const weights = new Map<number, number>();
  for (const handle of moving) {
    const position = anchors.indexOf(handle),
      left = anchors[Math.max(0, position - 1)],
      right = anchors[Math.min(anchors.length - 1, position + 1)];
    for (const neighbour of [left, right])
      if (
        neighbour !== handle &&
        distance(target, track.points[neighbour]) < 0.5
      )
        throw new Error("Keep the handle clear of its neighbouring handles.");
    const ramp = (from: number, to: number, rising: boolean) => {
      if (from === to) {
        weights.set(handle, 1);
        return;
      }
      const cumulative = [0];
      for (let i = from + 1; i <= to; i++)
        cumulative.push(
          cumulative.at(-1)! + distance(track.points[i - 1], track.points[i]),
        );
      const length = cumulative.at(-1)!;
      for (let i = from; i <= to; i++) {
        const fraction = length
          ? cumulative[i - from] / length
          : (i - from) / (to - from);
        weights.set(
          i,
          Math.max(weights.get(i) ?? 0, rising ? fraction : 1 - fraction),
        );
      }
    };
    ramp(left, handle, true);
    ramp(handle, right, false);
  }
  const original = track.points[index],
    dLat = target.lat - original.lat,
    dLon = ((target.lon - original.lon + 540) % 360) - 180;
  if (Math.abs(dLat) + Math.abs(dLon) < 1e-12) return track;
  const moved = new Set<number>();
  const points = track.points.map((point, i) => {
    const weight = weights.get(i) ?? 0;
    if (weight <= 1e-12) return point;
    const changed: Point = {
      ...point,
      lat: point.lat + dLat * weight,
      lon: ((point.lon + dLon * weight + 540) % 360) - 180,
      ele: undefined,
      time: undefined,
      terrain: undefined,
    };
    validCoordinate(changed);
    moved.add(i);
    return changed;
  });
  for (let i = 1; i < points.length; i++)
    if (moved.has(i - 1) || moved.has(i))
      points[i] = { ...points[i], terrainPending: true, terrain: undefined };
  return { ...track, points };
}

export function closeInputLoop(track: Track): Track {
  if (track.points.length < 3)
    throw new Error("An input needs at least three points to close a loop.");
  if (isClosedRoute(track)) return track;
  const first = track.points[0],
    last = track.points.at(-1)!;
  if (distance(first, last) < 0.5) {
    const points = [...track.points];
    points[points.length - 1] = {
      ...last,
      lat: first.lat,
      lon: first.lon,
      ele: first.ele,
      time: undefined,
      terrain: undefined,
      terrainPending: true,
    };
    return { ...track, points };
  }
  return insertInputPoint(track, track.points.length, first);
}

export function needsTerrain(track: Track): boolean {
  return track.points.some(
    (point) =>
      point.ele === undefined ||
      point.terrainPending ||
      (point.gapBefore && !point.terrain),
  );
}

// The temporary marker survives terrain sampling, but is never persisted or exported.
type IndexedPoint = Point & { inputOriginalIndex?: number };
export function prepareInputTerrain(track: Track): Track {
  return {
    ...track,
    points: track.points.map((point, inputOriginalIndex): IndexedPoint => {
      const missing =
        point.ele === undefined ||
        (inputOriginalIndex > 0 &&
          track.points[inputOriginalIndex - 1].ele === undefined);
      return {
        ...point,
        inputOriginalIndex,
        gapBefore:
          (inputOriginalIndex > 0 &&
            (!!point.gapBefore || !!point.terrainPending || missing)) ||
          undefined,
        terrain: point.terrainPending || missing ? undefined : point.terrain,
      };
    }),
  };
}
export function finishInputTerrain(original: Track, sampled: Track): Track {
  let edge = original.points.length - 1;
  const points: Point[] = new Array(sampled.points.length);
  for (let i = sampled.points.length - 1; i >= 0; i--) {
    const {
      inputOriginalIndex,
      terrainPending: _pending,
      ...point
    } = sampled.points[i] as IndexedPoint;
    if (inputOriginalIndex !== undefined) edge = inputOriginalIndex;
    const source = original.points[edge];
    points[i] = {
      ...point,
      gapBefore: (i > 0 && !!source.gapBefore) || undefined,
      terrain: point.terrain,
      ...(inputOriginalIndex !== undefined && source.ele !== undefined
        ? { ele: source.ele }
        : {}),
    };
  }
  return { ...original, points };
}

/** Keep the selected point and every point on the requested side. */
export function trimInputTrack(
  track: Track,
  index: number,
  direction: "before" | "after",
): Track {
  validIndex(track, index);
  if (
    (direction === "before" && index >= track.points.length - 1) ||
    (direction === "after" && index < 1)
  )
    throw new Error("A trimmed input track must keep at least two points.");
  const points =
    direction === "before"
      ? track.points.slice(index)
      : track.points.slice(0, index + 1);
  if (direction === "before")
    points[0] = {
      ...points[0],
      gapBefore: undefined,
      terrain: undefined,
      terrainPending: undefined,
    };
  return { ...track, points };
}
