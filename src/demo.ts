import { type Track, uid } from "./model";
// Deliberately small illustrative tracks, never presented as navigation guidance.
export function demoTracks(): Track[] {
  const make = (name: string, color: string, coords: number[][]): Track => ({
    id: uid(),
    name,
    color,
    source: "Illustrative sample · Glen Coe",
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
    make("Glen Coe · valley trail", "#16724d", [
      [56.673, -5.088, 42],
      [56.672, -5.077, 68],
      [56.669, -5.063, 113],
      [56.665, -5.048, 161],
      [56.663, -5.033, 204],
      [56.658, -5.021, 256],
      [56.654, -5.008, 321],
      [56.65, -4.997, 380],
      [56.647, -4.984, 418],
      [56.645, -4.968, 402],
    ]),
    make("Lost Valley · upper section", "#d78332", [
      [56.642, -4.961, 427],
      [56.638, -4.961, 495],
      [56.634, -4.963, 586],
      [56.63, -4.966, 662],
      [56.626, -4.967, 741],
      [56.623, -4.972, 814],
      [56.62, -4.978, 872],
    ]),
  ];
}
