import { type Track, uid } from "./model";
export const DEMO_SOURCE = "Illustrative sample · Glendalough, County Wicklow";
export const isDemoTrack = (track: Track) => track.source === DEMO_SOURCE;
// Deliberately small illustrative tracks, never presented as navigation guidance.
export function demoTracks(): Track[] {
  const make = (name: string, color: string, coords: number[][]): Track => ({
    id: uid(),
    name,
    color,
    source: DEMO_SOURCE,
    kind: "track",
    points: coords.flatMap((b, i) => {
      if (!i) return [{ lat: b[0], lon: b[1], ele: b[2] }];
      const a = coords[i - 1];
      return Array.from({ length: 12 }, (_, j) => {
        const f = (j + 1) / 12;
        return {
          lat: a[0] + (b[0] - a[0]) * f,
          lon: a[1] + (b[1] - a[1]) * f,
          ele: Math.round(a[2] + (b[2] - a[2]) * f),
        };
      });
    }),
  });
  return [
    make("Glendalough · Upper Lake", "#16724d", [
      [53.0106, -6.3271, 135],
      [53.0097, -6.3314, 133],
      [53.0087, -6.3358, 130],
      [53.0077, -6.3401, 132],
      [53.0072, -6.3445, 138],
      [53.0074, -6.3494, 142],
      [53.0071, -6.3546, 149],
      [53.0062, -6.3601, 161],
      [53.0051, -6.3653, 178],
      [53.0035, -6.3701, 205],
    ]),
    make("Glendalough · Spinc ridge", "#d78332", [
      [53.0012, -6.3734, 253],
      [52.9998, -6.3701, 302],
      [52.9986, -6.3654, 359],
      [52.9984, -6.3602, 407],
      [52.9993, -6.3551, 446],
      [53.0002, -6.3504, 472],
      [53.0016, -6.3466, 405],
    ]),
  ];
}
