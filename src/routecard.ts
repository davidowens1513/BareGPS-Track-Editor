import { analytics, distance, type Track } from "./model";
import {
  coordinateSystems,
  formatCoordinate,
  type CoordinateSystem,
} from "./coordinates";

export function routecardText(
  route: Track,
  system: CoordinateSystem,
  terrain?: Track,
): string {
  const stats = analytics((terrain ?? route).points);
  const km = (value: number) => `${(value / 1000).toFixed(2)} km`;
  let total = 0;
  return [
    `${route.name} — Routecard`,
    `${route.points.length} points · ${km(stats.length)}`,
    `Coordinates: ${coordinateSystems[system]}`,
    "",
    ...route.points.map((point, i) => {
      const leg = i ? distance(route.points[i - 1], point) : 0;
      total += leg;
      const label = [
        `Point ${i + 1}`,
        point.name?.trim(),
        i === 0 ? "Start" : i === route.points.length - 1 ? "End" : "",
      ]
        .filter(Boolean)
        .join(" · ");
      return `${label}\n${formatCoordinate(point, system)}\nLeg: ${km(leg)} · Total: ${km(total)} · Height: ${point.ele === undefined ? "unavailable" : `${Math.round(point.ele)} m`}\n`;
    }),
    "Distances join points by straight lines and do not automatically follow paths.",
    "Heights, where available, are estimates. Check the route is walkable.",
    "Created with BareGPS Route Planner",
  ].join("\n");
}
