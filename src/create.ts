import { type Track, type Point, uid, distance } from "./model";

export const MAX_WAYPOINTS = 1000;
export function newCreatedRoute(): Track {
  return {
    id: uid(),
    name: "My walking route",
    color: "#16724d",
    kind: "route",
    source: "Created in BareGPS",
    points: [],
  };
}
function validPoint(point: Point) {
  if (
    !Number.isFinite(point.lat) ||
    Math.abs(point.lat) > 85.05112878 ||
    !Number.isFinite(point.lon) ||
    Math.abs(point.lon) > 180
  )
    throw new Error("Choose a point within the map’s supported area.");
}
export function insertWaypoint(
  route: Track,
  index: number,
  point: Point,
): Track {
  validPoint(point);
  if (!Number.isInteger(index) || index < 0 || index > route.points.length)
    throw new Error("That route segment has changed. Try again.");
  if (route.points.length >= MAX_WAYPOINTS)
    throw new Error(
      "This route has 1,000 waypoints. Save it and start a new route.",
    );
  if (
    [route.points[index - 1], route.points[index]].some(
      (p) => p && distance(p, point) < 0.5,
    )
  )
    throw new Error(
      "That point is too close to its neighbour. Drag the existing marker instead.",
    );
  const points = route.points.map(({ lat, lon, name }) => ({ lat, lon, name }));
  points.splice(index, 0, { lat: point.lat, lon: point.lon, name: point.name });
  return { ...route, points };
}
export function moveWaypoint(route: Track, index: number, point: Point): Track {
  validPoint(point);
  if (!Number.isInteger(index) || !route.points[index])
    throw new Error("That waypoint no longer exists.");
  if (
    [route.points[index - 1], route.points[index + 1]].some(
      (p) => p && distance(p, point) < 0.5,
    )
  )
    throw new Error("Keep a little space between neighbouring points.");
  const points = route.points.map(({ lat, lon, name }) => ({ lat, lon, name }));
  points[index] = { ...points[index], lat: point.lat, lon: point.lon };
  return { ...route, points };
}
export function removeWaypoint(route: Track, index: number): Track {
  if (!Number.isInteger(index) || !route.points[index])
    throw new Error("That waypoint no longer exists.");
  return {
    ...route,
    points: route.points
      .filter((_, i) => i !== index)
      .map(({ lat, lon, name }) => ({ lat, lon, name })),
  };
}

export type DrawingMode = "add" | "insert";
export function routeTapIndex(
  mode: DrawingMode,
  pointCount: number,
  segmentEnd?: number,
): number | null {
  if (mode === "add") return pointCount;
  return segmentEnd !== undefined && segmentEnd > 0 && segmentEnd < pointCount
    ? segmentEnd
    : null;
}
export function isClosedRoute(route: Track): boolean {
  const first = route.points[0],
    last = route.points.at(-1);
  return (
    route.points.length >= 3 &&
    !!first &&
    !!last &&
    first.lat === last.lat &&
    first.lon === last.lon
  );
}
export function closeRoute(route: Track): Track {
  if (route.points.length < 3)
    throw new Error("Add at least three points before closing a loop.");
  if (isClosedRoute(route)) return route;
  const first = route.points[0],
    last = route.points.at(-1)!;
  if (distance(first, last) < 0.5) {
    const points = route.points.map(({ lat, lon, name }) => ({
      lat,
      lon,
      name,
    }));
    points[points.length - 1] = {
      ...points.at(-1)!,
      lat: first.lat,
      lon: first.lon,
    };
    return { ...route, points };
  }
  return insertWaypoint(route, route.points.length, first);
}
