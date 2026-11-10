import type { Track } from "./model";
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
