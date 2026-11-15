import { analytics, type Track, type Point } from "./model";
export function assessElevation(track: Track, points: Point[] = track.points) {
  const stats = analytics(points);
  const hasElevation = points.some((p) => p.ele !== undefined);
  const stale =
    !!track.terrainNeedsRefresh || points.some((p) => p.terrainPending);
  const status = stale
    ? "Needs refresh"
    : !hasElevation
      ? "Unavailable"
      : stats.missingEdges || stats.estimatedGap
        ? "Partial"
        : "Complete";
  return {
    status,
    hasElevation,
    available: status === "Complete",
    stats,
    ascent: status === "Complete" ? stats.ascent : undefined,
    descent: status === "Complete" ? stats.descent : undefined,
  };
}
