import { needsTerrain } from "./input-edit";
import { analytics, type Track } from "./model";
import {
  coordinateSystems,
  formatCoordinate,
  type CoordinateSystem,
} from "./coordinates";

export const SUMMARY_CARD_POINTS = 30;

export function routecardRows(route: Track, terrain?: Track, full = false) {
  const sampled = terrain?.points;
  let cursor = 0,
    total = 0,
    totalAscent: number | undefined = 0;
  const rows = route.points.map((point, i) => {
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
    return {
      point,
      index: i,
      distance: stats.length,
      total,
      ascent,
      totalAscent,
    };
  });
  if (full || rows.length <= SUMMARY_CARD_POINTS) return rows;
  const chosen = new Set([0, rows.length - 1]);
  rows.forEach((row, i) => {
    if (row.point.name?.trim()) chosen.add(i);
  });
  // Split the longest remaining distance interval. Zero-length sections use
  // point order so repeated coordinates still yield distinct checkpoints.
  while (chosen.size < SUMMARY_CARD_POINTS) {
    const ordered = [...chosen].sort((a, b) => a - b);
    let candidate = -1,
      largest = -1;
    for (let n = 1; n < ordered.length; n++) {
      const start = ordered[n - 1],
        end = ordered[n];
      if (end - start < 2) continue;
      const length = rows[end].total - rows[start].total;
      const score = length || (end - start) * Number.EPSILON;
      if (score <= largest) continue;
      const target = (rows[start].total + rows[end].total) / 2;
      let middle = Math.floor((start + end) / 2);
      if (length) {
        middle = start + 1;
        for (let i = start + 2; i < end; i++)
          if (
            Math.abs(rows[i].total - target) <
            Math.abs(rows[middle].total - target)
          )
            middle = i;
      }
      candidate = middle;
      largest = score;
    }
    if (candidate < 0) break;
    chosen.add(candidate);
  }
  let previous = -1;
  return [...chosen]
    .sort((a, b) => a - b)
    .map((index) => {
      let distance = 0,
        ascent: number | undefined = 0;
      for (let i = previous + 1; i <= index; i++) {
        distance += rows[i].distance;
        ascent =
          ascent === undefined || rows[i].ascent === undefined
            ? undefined
            : ascent + rows[i].ascent!;
      }
      previous = index;
      return { ...rows[index], distance, ascent };
    });
}

export function routecardText(
  route: Track,
  system: CoordinateSystem,
  terrain?: Track,
  pointOffset = 0,
  full = false,
): string {
  const rows = routecardRows(route, terrain, full);
  const km = (value: number) => `${(value / 1000).toFixed(2)} km`;
  const metres = (value: number | undefined) =>
    value === undefined ? "unavailable" : `${Math.round(value)} m`;
  return [
    `${route.name} — Routecard`,
    `${rows.length} checkpoints${rows.length < route.points.length ? ` from ${route.points.length} route points` : ""} · ${km(rows.at(-1)?.total ?? 0)}`,
    `Coordinates: ${coordinateSystems[system]}`,
    ...(needsTerrain(terrain ?? route)
      ? ["Terrain incomplete — heights and ascent are partial."]
      : []),
    "",
    ...rows.map(({ point, index, distance, total, ascent, totalAscent }) => {
      const label = [
        `Point ${index + 1 + pointOffset}`,
        point.name?.trim(),
        index === 0 ? "Start" : index === route.points.length - 1 ? "End" : "",
      ]
        .filter(Boolean)
        .join(" · ");
      return `${label}\n${formatCoordinate(point, system)}\nLeg: ${km(distance)} · Total: ${km(total)} · Height: ${metres(point.ele)}\nAscent: ${metres(ascent)} · Cumulative ascent: ${metres(totalAscent)}\n`;
    }),
    "Distances follow the full route between checkpoints; route legs do not automatically follow paths.",
    "Heights and ascent, where available, are estimates. Check the route is walkable.",
    "Created with BareGPS Track Editor",
  ].join("\n");
}
