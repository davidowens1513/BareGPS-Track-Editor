import { analytics, type Track } from "./model";
import {
  coordinateSystems,
  formatCoordinate,
  type CoordinateSystem,
} from "./coordinates";

export function routecardRows(route: Track, terrain?: Track) {
  const sampled = terrain?.points;
  let cursor = 0,
    total = 0,
    totalAscent: number | undefined = 0;
  return route.points.map((point, i) => {
    let segment = i ? [route.points[i - 1], point] : [point];
    if (sampled && i) {
      const end = sampled.findIndex(
        (p, n) => n > cursor && p.lat === point.lat && p.lon === point.lon,
      );
      if (end >= 0) {
        segment = sampled.slice(cursor, end + 1);
        cursor = end;
      }
    }
    const stats = analytics(segment);
    total += stats.length;
    const ascent = stats.missingEdges ? undefined : stats.ascent;
    totalAscent =
      totalAscent === undefined || ascent === undefined
        ? undefined
        : totalAscent + ascent;
    return { point, distance: stats.length, total, ascent, totalAscent };
  });
}

export function routecardText(
  route: Track,
  system: CoordinateSystem,
  terrain?: Track,
  pointOffset = 0,
): string {
  const rows = routecardRows(route, terrain);
  const km = (value: number) => `${(value / 1000).toFixed(2)} km`;
  const metres = (value: number | undefined) =>
    value === undefined ? "unavailable" : `${Math.round(value)} m`;
  return [
    `${route.name} — Routecard`,
    `${route.points.length} points · ${km(rows.at(-1)?.total ?? 0)}`,
    `Coordinates: ${coordinateSystems[system]}`,
    "",
    ...rows.map(({ point, distance, total, ascent, totalAscent }, i) => {
      const label = [
        `Point ${i + 1 + pointOffset}`,
        point.name?.trim(),
        i === 0 ? "Start" : i === route.points.length - 1 ? "End" : "",
      ]
        .filter(Boolean)
        .join(" · ");
      return `${label}\n${formatCoordinate(point, system)}\nLeg: ${km(distance)} · Total: ${km(total)} · Height: ${metres(point.ele)}\nAscent: ${metres(ascent)} · Cumulative ascent: ${metres(totalAscent)}\n`;
    }),
    "Distances join points by straight lines and do not automatically follow paths.",
    "Heights and ascent, where available, are estimates. Check the route is walkable.",
    "Created with BareGPS Route Planner",
  ].join("\n");
}
