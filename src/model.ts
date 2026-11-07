export interface Point {
  lat: number;
  lon: number;
  ele?: number;
  time?: string;
  gapBefore?: boolean;
  terrain?: boolean;
}
export interface Track {
  id: string;
  name: string;
  color: string;
  points: Point[];
  source: string;
  kind: "track" | "route";
}
export interface Selection {
  start: number;
  end: number;
}
export interface Workspace {
  version: 1;
  created?: Track;
  createdTerrain?: Track;
  tracks: Track[];
  route: Track | null;
  activeId: string | null;
  selection: Selection;
}
export const MAX_BYTES = 15 * 1024 * 1024;
export const MAX_POINTS = 150000;
export const COLORS = [
  "#16724d",
  "#d78332",
  "#5b69b0",
  "#c35d68",
  "#278aa2",
  "#8b674a",
];
export const uid = () => crypto.randomUUID();
export const emptyWorkspace = (): Workspace => ({
  version: 1,
  tracks: [],
  route: null,
  activeId: null,
  selection: { start: 0, end: 0 },
});
export function distance(a: Point, b: Point): number {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) *
      Math.cos(b.lat * rad) *
      Math.sin(((b.lon - a.lon) * rad) / 2) ** 2;
  return (
    6371008.8 *
    2 *
    Math.atan2(Math.sqrt(Math.min(1, h)), Math.sqrt(Math.max(0, 1 - h)))
  );
}
export function analytics(points: Point[]) {
  let length = 0,
    ascent = 0,
    descent = 0,
    gapDistance = 0,
    missingEdges = 0,
    estimatedGap = false;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      d = distance(a, b);
    length += d;
    if (b.gapBefore) {
      gapDistance += d;
      if (!b.terrain) estimatedGap = true;
    }
    if (a.ele === undefined || b.ele === undefined) {
      missingEdges++;
      continue;
    }
    const delta = b.ele - a.ele;
    if (delta > 0) ascent += delta;
    else descent -= delta;
  }
  const elevations = points.flatMap((p) =>
    p.ele === undefined ? [] : [p.ele],
  );
  return {
    length,
    ascent,
    descent,
    gapDistance,
    missingEdges,
    estimatedGap,
    min: elevations.length
      ? elevations.reduce((a, b) => Math.min(a, b), Infinity)
      : undefined,
    max: elevations.length
      ? elevations.reduce((a, b) => Math.max(a, b), -Infinity)
      : undefined,
  };
}
export function selectedPoints(track: Track, selection: Selection) {
  const start = Math.max(0, Math.min(track.points.length - 2, selection.start));
  const end = Math.max(
    start + 1,
    Math.min(track.points.length - 1, selection.end),
  );
  return track.points
    .slice(start, end + 1)
    .map((p, i) => (i === 0 ? { ...p, gapBefore: undefined } : { ...p }));
}
export function section(
  track: Track,
  selection: Selection,
  name = `${track.name} · section`,
): Track {
  return {
    ...track,
    id: uid(),
    name,
    kind: "track",
    points: selectedPoints(track, selection),
  };
}
export function split(track: Track, index: number): [Track, Track] {
  if (!Number.isInteger(index) || index < 1 || index > track.points.length - 2)
    throw new Error(
      "Choose a split point inside the track. Each side needs at least two points.",
    );
  return [
    section(track, { start: 0, end: index }, `${track.name} · 1`),
    section(
      track,
      { start: index, end: track.points.length - 1 },
      `${track.name} · 2`,
    ),
  ];
}
export function join(
  route: Track | null,
  track: Track,
  selection: Selection,
): Track {
  const part = selectedPoints(track, selection);
  if (!route)
    return {
      id: uid(),
      name: "My joined route",
      color: "#16724d",
      points: part,
      source: "Joined in BareGPS",
      kind: "route",
    };
  const result = structuredClone(route);
  const last = result.points.at(-1)!;
  if (distance(last, part[0]) < 0.05 && last.ele === part[0].ele) part.shift();
  else if (distance(last, part[0]) > 1) part[0].gapBefore = true;
  if (result.points.length + part.length > MAX_POINTS)
    throw new Error(
      "This route is too large. Keep the route below 150,000 points.",
    );
  result.points.push(...part);
  return result;
}
export function reverse(track: Track): Track {
  const points = track.points
    .map((p, i) => ({
      ...p,
      gapBefore: track.points[i + 1]?.gapBefore,
      terrain: track.points[i + 1]?.terrain,
    }))
    .reverse();
  points[0].gapBefore = undefined;
  return { ...track, points };
}
const children = (el: Element, name: string) =>
  Array.from(el.children).filter((e) => e.localName === name);
const childText = (el: Element, name: string) =>
  children(el, name)[0]?.textContent?.trim();
export function parseGPX(xml: string, filename: string): Track[] {
  if (new TextEncoder().encode(xml).length > MAX_BYTES)
    throw new Error(
      "This file is over 15 MB. Export a smaller GPX file and try again.",
    );
  if (/<!DOCTYPE|<!ENTITY/i.test(xml))
    throw new Error(
      "GPX files containing document types or entities are not supported.",
    );
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (
    doc.querySelector("parsererror") ||
    doc.documentElement.localName !== "gpx"
  )
    throw new Error(
      "This is not a valid GPX file. Please choose a GPX track or route.",
    );
  const results: Track[] = [];
  let count = 0;
  const parents = Array.from(doc.documentElement.children).filter((e) =>
    ["trk", "rte"].includes(e.localName),
  );
  for (const [index, parent] of parents.entries()) {
    const groups =
      parent.localName === "trk"
        ? children(parent, "trkseg").map((s) => children(s, "trkpt"))
        : [children(parent, "rtept")];
    const points: Point[] = [];
    for (const group of groups) {
      for (const [i, el] of group.entries()) {
        if (++count > MAX_POINTS)
          throw new Error(
            "This file has more than 150,000 points. Please divide it into smaller files.",
          );
        const latText = el.getAttribute("lat"),
          lonText = el.getAttribute("lon");
        const lat = Number(latText),
          lon = Number(lonText);
        if (
          !latText?.trim() ||
          !lonText?.trim() ||
          !Number.isFinite(lat) ||
          !Number.isFinite(lon) ||
          Math.abs(lat) > 90 ||
          Math.abs(lon) > 180
        )
          throw new Error(
            `Invalid coordinates at point ${count}. The file was not imported.`,
          );
        const eleText = childText(el, "ele"),
          time = childText(el, "time");
        const ele = eleText ? Number(eleText) : undefined;
        if (ele !== undefined && !Number.isFinite(ele))
          throw new Error(
            `Invalid elevation at point ${count}. The file was not imported.`,
          );
        const ext = children(el, "extensions")[0];
        const gap = ext
          ? Array.from(ext.children).find((e) => e.localName === "gapBefore")
              ?.textContent === "true"
          : false;
        const terrain = ext
          ? Array.from(ext.children).find((e) => e.localName === "terrain")
              ?.textContent === "true"
          : false;
        points.push({
          lat,
          lon,
          ele,
          time: time && Number.isFinite(Date.parse(time)) ? time : undefined,
          gapBefore: (points.length > 0 && (i === 0 || gap)) || undefined,
          terrain: terrain || undefined,
        });
      }
    }
    if (points.length < 2) continue;
    const ext = children(parent, "extensions")[0];
    const color = ext
      ? Array.from(ext.children).find((e) => e.localName === "color")
          ?.textContent
      : undefined;
    results.push({
      id: uid(),
      name:
        childText(parent, "name") ||
        filename.replace(/\.gpx$/i, "") +
          (parents.length > 1 ? ` · ${index + 1}` : ""),
      source: filename,
      color:
        color && /^#[0-9a-f]{6}$/i.test(color)
          ? color
          : COLORS[index % COLORS.length],
      points,
      kind: "track",
    });
  }
  if (!results.length)
    throw new Error(
      "No usable tracks found. A GPX track or route needs at least two points.",
    );
  return results;
}
const escapeXML = (s: string) =>
  s.replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
export function exportGPX(track: Track): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="BareGPS Track Editor" xmlns="http://www.topografix.com/GPX/1/1" xmlns:b="https://baregps.app/gpx/1"><metadata><name>${escapeXML(track.name)}</name><desc>Dashed gaps are straight-line walking connections included in distance and ascent. Elevation may be estimated.</desc></metadata><trk><name>${escapeXML(track.name)}</name><extensions><b:color>${track.color}</b:color></extensions><trkseg>\n${track.points.map((p) => `<trkpt lat="${p.lat}" lon="${p.lon}">${p.ele !== undefined ? `<ele>${p.ele}</ele>` : ""}${p.time ? `<time>${escapeXML(p.time)}</time>` : ""}${p.gapBefore ? `<extensions><b:gapBefore>true</b:gapBefore>${p.terrain ? "<b:terrain>true</b:terrain>" : ""}</extensions>` : ""}</trkpt>`).join("\n")}\n</trkseg></trk></gpx>\n`;
}
export function validateWorkspace(value: unknown): value is Workspace {
  if (!value || typeof value !== "object") return false;
  const w = value as Workspace;
  if (
    w.version !== 1 ||
    !Array.isArray(w.tracks) ||
    w.tracks.length > 100 ||
    !w.selection ||
    !Number.isInteger(w.selection.start) ||
    !Number.isInteger(w.selection.end)
  )
    return false;
  let total = 0;
  const all = [
    ...w.tracks,
    ...(w.route ? [w.route] : []),
    ...(w.created ? [w.created] : []),
    ...(w.createdTerrain ? [w.createdTerrain] : []),
  ];
  return (
    all.every(
      (t) =>
        t &&
        typeof t.id === "string" &&
        /^[a-z0-9-]{1,64}$/i.test(t.id) &&
        typeof t.name === "string" &&
        typeof t.source === "string" &&
        ["track", "route"].includes(t.kind) &&
        /^#[0-9a-f]{6}$/i.test(t.color) &&
        Array.isArray(t.points) &&
        t.points.length >= (t === w.created ? 0 : 2) &&
        (t !== w.created || t.points.length <= 1000) &&
        t.points.length <= MAX_POINTS &&
        (t === w.created ||
          t === w.createdTerrain ||
          (total += t.points.length) <= MAX_POINTS * 3) &&
        t.points.every(
          (p) =>
            p &&
            Number.isFinite(p.lat) &&
            Math.abs(p.lat) <= 90 &&
            Number.isFinite(p.lon) &&
            Math.abs(p.lon) <= 180 &&
            (p.ele === undefined || Number.isFinite(p.ele)) &&
            (p.time === undefined || typeof p.time === "string") &&
            (p.gapBefore === undefined || typeof p.gapBefore === "boolean") &&
            (p.terrain === undefined || typeof p.terrain === "boolean"),
        ),
    ) &&
    (w.activeId === null ||
      [...w.tracks, ...(w.route ? [w.route] : [])].some(
        (t) => t.id === w.activeId,
      ))
  );
}
