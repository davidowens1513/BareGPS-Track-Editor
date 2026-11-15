import type { Track } from "./model";
export function needsTerrain(track: Track): boolean {
  return (
    !!track.terrainNeedsRefresh ||
    track.points.some(
      (point) =>
        point.ele === undefined ||
        point.terrainPending ||
        (point.gapBefore && !point.terrain),
    )
  );
}
