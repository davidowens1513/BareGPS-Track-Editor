import { analytics, distance, uid, type Point, type Track } from "./model";
const RADIUS = 6371008.8;
type Vector = [number, number, number];
const dot = (a: Vector, b: Vector) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vector, b: Vector): Vector => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a: Vector) => Math.hypot(...a);
function vector(p: Point): Vector {
  const lat = (p.lat * Math.PI) / 180,
    lon = (p.lon * Math.PI) / 180;
  return [
    Math.cos(lat) * Math.cos(lon),
    Math.cos(lat) * Math.sin(lon),
    Math.sin(lat),
  ];
}
const angle = (a: Vector, b: Vector) =>
  Math.atan2(norm(cross(a, b)), dot(a, b));
function segmentDistance(p: Vector, a: Vector, b: Vector): number {
  const n = cross(a, b),
    length = norm(n),
    ab = angle(a, b);
  if (length < 1e-12) return Math.min(angle(p, a), angle(p, b)) * RADIUS;
  const unit = n.map((v) => v / length) as Vector;
  const projection = p.map((v, i) => v - dot(p, unit) * unit[i]) as Vector;
  const size = norm(projection);
  let best = Math.min(angle(p, a), angle(p, b));
  if (size > 1e-12) {
    const q = projection.map((v) => v / size) as Vector;
    if (angle(a, q) + angle(q, b) <= ab + 1e-10)
      best = Math.min(best, angle(p, q));
  }
  return best * RADIUS;
}
/** Distance from a point to the finite great-circle segment, in metres. */
export function trackSegmentDeviation(p: Point, a: Point, b: Point) {
  return segmentDistance(vector(p), vector(a), vector(b));
}

/** Density is a target; the geometric error and protected points take priority. */
export function simplifyTrack(source: Track) {
  if (source.points.length < 2)
    throw new Error("Choose a track with at least two points.");
  const points = source.points,
    vectors = points.map(vector);
  const cumulative = [0];
  const chosen = new Set([0, points.length - 1]);
  for (let i = 0; i < points.length; i++) {
    if (points[i].name?.trim()) chosen.add(i);
    if (i) {
      cumulative[i] =
        cumulative[i - 1] +
        (points[i].gapBefore ? 0 : distance(points[i - 1], points[i]));
      if (points[i].gapBefore) {
        chosen.add(i - 1);
        chosen.add(i);
      }
    }
  }
  const length = cumulative.at(-1)!;
  const target = Math.min(
    points.length,
    5001,
    Math.max(2, Math.ceil(length / 100) + 1),
  );
  let operations = 0;
  const refine = () => {
    const anchors = [...chosen].sort((a, b) => a - b);
    const stack: [number, number][] = [];
    for (let i = 1; i < anchors.length; i++)
      stack.push([anchors[i - 1], anchors[i]]);
    while (stack.length) {
      const [start, end] = stack.pop()!;
      let worst = -1,
        deviation = 10;
      for (let i = start + 1; i < end; i++) {
        if (++operations > 4000000)
          throw new Error(
            "This track is too complex to simplify safely in one operation. Split it into smaller sections and try again.",
          );
        const error = segmentDistance(vectors[i], vectors[start], vectors[end]);
        if (error > deviation) {
          deviation = error;
          worst = i;
        }
      }
      if (worst >= 0) {
        chosen.add(worst);
        stack.push([start, worst], [worst, end]);
      }
    }
  };
  refine();
  const ordered = [...chosen].sort((a, b) => a - b);
  while (chosen.size < target) {
    let slot = -1,
      largest = -1;
    for (let n = 1; n < ordered.length; n++) {
      const a = ordered[n - 1],
        b = ordered[n];
      if (b - a < 2) continue;
      const gap = cumulative[b] - cumulative[a];
      if (gap > largest) {
        largest = gap;
        slot = n;
      }
    }
    if (slot < 0 || largest === 0) break;
    const start = ordered[slot - 1],
      end = ordered[slot],
      mid = (cumulative[start] + cumulative[end]) / 2;
    let lo = start + 1,
      hi = end - 1;
    while (lo < hi) {
      const m = Math.floor((lo + hi) / 2);
      if (cumulative[m] < mid) lo = m + 1;
      else hi = m;
    }
    let index = lo;
    if (
      lo > start + 1 &&
      Math.abs(cumulative[lo - 1] - mid) < Math.abs(cumulative[lo] - mid)
    )
      index = lo - 1;
    chosen.add(index);
    ordered.splice(slot, 0, index);
  }
  // Adding a retained point can change the segment's error: recheck the bound.
  refine();
  const indices = [...chosen].sort((a, b) => a - b);
  let maxDeviation = 0;
  for (let n = 1; n < indices.length; n++) {
    const a = indices[n - 1],
      b = indices[n];
    for (let i = a + 1; i < b; i++)
      maxDeviation = Math.max(
        maxDeviation,
        segmentDistance(vectors[i], vectors[a], vectors[b]),
      );
  }
  const resultPoints = indices.map((index, n) => {
    const point = { ...points[index] };
    if (n && index - indices[n - 1] > 1) {
      point.terrainPending = true;
      point.terrain = undefined;
      point.time = undefined;
    }
    return point;
  });
  const changed = resultPoints.length !== points.length;
  // A simplified route is a plan, not a recorded activity with inferred timing.
  if (changed)
    resultPoints.forEach((p) => {
      p.time = undefined;
    });
  const track: Track = {
    ...source,
    id: uid(),
    name: `${source.name} (simplified)`,
    source: `Simplified from ${source.source}`,
    points: resultPoints,
    simplified: true,
    terrainNeedsRefresh: changed || source.terrainNeedsRefresh,
  };
  return {
    track,
    maxDeviation,
    handlesPerKm: length ? (resultPoints.length - 1) / (length / 1000) : 0,
    originalLength: analytics(points).length,
  };
}
