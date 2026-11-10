import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { distance, MAX_POINTS, type Point, type Track } from "./model";
export function sampleGaps(track: Track): Track {
  const points: Point[] = [];
  for (let i = 0; i < track.points.length; i++) {
    const b = track.points[i],
      a = track.points[i - 1];
    if (a && b.gapBefore && !b.terrain) {
      const steps = Math.max(1, Math.ceil(distance(a, b) / 90));
      if (steps > 1500)
        throw new Error(
          "This leg is over 135 km. Add points to make shorter connections before fetching terrain.",
        );
      let delta = ((b.lon - a.lon + 540) % 360) - 180;
      for (let j = 1; j < steps; j++)
        points.push({
          lat: a.lat + ((b.lat - a.lat) * j) / steps,
          lon: ((a.lon + (delta * j) / steps + 540) % 360) - 180,
          gapBefore: true,
        });
    }
    points.push({ ...b });
    if (points.length > MAX_POINTS)
      throw new Error("Terrain sampling would exceed the route point limit.");
  }
  const missing = points.filter((p) => p.gapBefore && !p.terrain);
  if (missing.length > 5000)
    throw new Error(
      "Too many terrain samples. Try fetching smaller input tracks.",
    );
  return { ...track, points };
}
// Bound the complete job, including pacing, requests and response bodies.
export async function enrichTerrain(
  track: Track,
  progress: (s: string) => void,
  signal: AbortSignal,
): Promise<Track> {
  signal.throwIfAborted();
  const controller = new AbortController();
  const cancel = () => controller.abort(signal.reason);
  signal.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(
    () =>
      controller.abort(
        new Error(
          "Terrain job timed out. Your route is unchanged. Try again later.",
        ),
      ),
    180000,
  );
  try {
    return await runTerrain(track, progress, controller.signal);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", cancel);
  }
}

// Native requests cannot be stopped by this transport. Detach promptly on abort;
// the settled handlers consume late responses/errors without applying results.
async function bounded<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<T> {
  signal.throwIfAborted();
  const controller = new AbortController();
  let cancel!: () => void;
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await new Promise<T>((resolve, reject) => {
      const abort = (reason: unknown) => {
        controller.abort(reason);
        reject(reason);
      };
      cancel = () => abort(signal.reason);
      signal.addEventListener("abort", cancel, { once: true });
      timer = setTimeout(
        () =>
          abort(
            new Error(
              "Terrain request timed out. Your route is unchanged. Try again later.",
            ),
          ),
        timeoutMs,
      );
      Promise.resolve()
        .then(() => {
          controller.signal.throwIfAborted();
          return operation(controller.signal);
        })
        .then(resolve, reject);
    });
  } finally {
    clearTimeout(timer!);
    signal.removeEventListener("abort", cancel);
  }
}

async function runTerrain(
  track: Track,
  progress: (s: string) => void,
  signal: AbortSignal,
): Promise<Track> {
  const result = sampleGaps(track);
  const indices = result.points.flatMap((p, i) =>
    p.gapBefore && !p.terrain ? [i] : [],
  );
  if (!indices.length)
    throw new Error("There are no unsampled gaps in this track.");
  // Include the first point of each connector so ascent starts at terrain elevation.
  for (const index of [...indices])
    if (
      index > 0 &&
      !result.points[index - 1].gapBefore &&
      !indices.includes(index - 1)
    )
      indices.push(index - 1);
  const batches = Math.ceil(indices.length / 100);
  for (let start = 0; start < indices.length; start += 100) {
    signal.throwIfAborted();
    if (start)
      await bounded(
        () =>
          new Promise<void>((resolve) => {
            setTimeout(resolve, 1100);
          }),
        signal,
        2000,
      );
    signal.throwIfAborted();
    progress(`Fetching terrain · ${Math.floor(start / 100) + 1} of ${batches}`);
    const batch = indices.slice(start, start + 100);
    const locations = batch
      .map((i) => `${result.points[i].lat},${result.points[i].lon}`)
      .join("|");
    const data = await bounded(
      async (requestSignal) => {
        if (Capacitor.isNativePlatform()) {
          const response = await CapacitorHttp.get({
            url: "https://api.opentopodata.org/v1/mapzen",
            params: { locations },
            connectTimeout: 15000,
            readTimeout: 20000,
          });
          if (response.status !== 200)
            throw new Error(
              "Terrain service is unavailable or busy. Your track is unchanged.",
            );
          return response.data as {
            status?: string;
            results?: { elevation: number | null }[];
          };
        }
        const response = await fetch(
          `${import.meta.env.BASE_URL}terrain/v1/mapzen?locations=${encodeURIComponent(locations)}`,
          { signal: requestSignal },
        );
        if (!response.ok)
          throw new Error(
            "Terrain service is unavailable or busy. Your track is unchanged.",
          );
        return (await response.json()) as {
          status?: string;
          results?: { elevation: number | null }[];
        };
      },
      signal,
      20000,
    );
    signal.throwIfAborted();
    if (
      data.status !== "OK" ||
      data.results?.length !== batch.length ||
      data.results.some(
        (r) => r.elevation === null || !Number.isFinite(r.elevation),
      )
    )
      throw new Error(
        "Terrain heights are unavailable for part of this gap. Your track is unchanged.",
      );
    batch.forEach((index, j) => {
      result.points[index].ele = data.results![j].elevation!;
      if (result.points[index].gapBefore) result.points[index].terrain = true;
    });
  }
  signal.throwIfAborted();
  return result;
}
