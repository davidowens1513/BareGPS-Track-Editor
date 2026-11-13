export interface Point {
  lat: number;
  lon: number;
  name?: string;
  ele?: number;
  time?: string;
  gapBefore?: boolean;
  terrain?: boolean;
  terrainPending?: boolean;
}
export interface Track {
  id: string;
  name: string;
  color: string;
  points: Point[];
  source: string;
  kind: "track" | "route";
  inputTrackId?: string;
  terrainNeedsRefresh?: boolean;
  simplified?: boolean;
}
export interface Selection {
  start: number;
  end: number;
}
export interface Workspace {
  version: 1;
  tracks: Track[];
  inputOriginals?: Track[];
  routePlan?: Track[];
  confirmedPlan?: string[];
  route: Track | null;
  activeId: string | null;
  selection: Selection;
}
export const MAX_BYTES = 15 * 1024 * 1024;
export const MAX_POINTS = 5000;
export const MAX_INPUT_POINTS = 150000;
export const COLORS = [
  "#d32f2f",
  "#2563eb",
  "#ec4899",
  "#16724d",
  "#d78332",
  "#5b69b0",
  "#c35d68",
  "#278aa2",
  "#8b674a",
];
export const INPUT_COLOUR_PRESETS = [
  { name: "Red", color: "#ff0000" },
  { name: "Green", color: "#16724d" },
  { name: "Yellow", color: "#ffff00" },
  { name: "Blue", color: "#0000ff" },
  { name: "White", color: "#ffffff" },
  { name: "Black", color: "#000000" },
  { name: "Grey", color: "#808080" },
  { name: "Orange", color: "#ff8000" },
  { name: "Lime", color: "#80c000" },
  { name: "Turquoise", color: "#00a6a6" },
  { name: "Sky blue", color: "#00bfff" },
  { name: "Pink", color: "#ff69b4" },
  { name: "Purple", color: "#800080" },
  { name: "Brown", color: "#8b4513" },
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
    .map((p, i) =>
      i === 0
        ? { ...p, gapBefore: undefined, terrainPending: undefined }
        : { ...p },
    );
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
      name: "Edited Route",
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
      "This route is too large. Keep the route at or below 5,000 points.",
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
      terrainPending: track.points[i + 1]?.terrainPending,
    }))
    .reverse();
  points[0].gapBefore = undefined;
  points[0].terrainPending = undefined;
  return { ...track, points };
}
const children = (el: Element, name: string) =>
  Array.from(el.children).filter((e) => e.localName === name);
const childText = (el: Element, name: string) =>
  children(el, name)[0]?.textContent?.trim();
export function parseGPX(
  xml: string,
  filename: string,
  colourOffset = 0,
  pointLimit = MAX_POINTS,
): Track[] {
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
        if (++count > pointLimit)
          throw new Error(
            `This file has more than ${pointLimit.toLocaleString("en-IE")} points. Please divide it into smaller files.`,
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
        const terrainPending = ext
          ? Array.from(ext.children).some(
              (e) =>
                e.localName === "terrainPending" && e.textContent === "true",
            )
          : false;
        points.push({
          lat,
          lon,
          ele,
          name: childText(el, "name") || undefined,
          time: time && Number.isFinite(Date.parse(time)) ? time : undefined,
          gapBefore: (points.length > 0 && (i === 0 || gap)) || undefined,
          terrain: terrain || undefined,
          ...(terrainPending ? { terrainPending: true } : {}),
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
          : COLORS[(colourOffset + results.length) % COLORS.length],
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
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="BareGPS Track Editor" xmlns="http://www.topografix.com/GPX/1/1" xmlns:b="https://baregps.app/gpx/1"><metadata><name>${escapeXML(track.name)}</name><desc>Dashed gaps are straight-line walking connections included in distance and ascent. Elevation may be estimated.</desc></metadata><trk><name>${escapeXML(track.name)}</name><extensions><b:color>${track.color}</b:color></extensions><trkseg>\n${track.points.map((p) => `<trkpt lat="${p.lat}" lon="${p.lon}">${p.ele !== undefined ? `<ele>${p.ele}</ele>` : ""}${p.time ? `<time>${escapeXML(p.time)}</time>` : ""}${p.name ? `<name>${escapeXML(p.name)}</name>` : ""}${p.gapBefore || p.terrainPending ? `<extensions>${p.gapBefore ? "<b:gapBefore>true</b:gapBefore>" : ""}${p.gapBefore && p.terrain ? "<b:terrain>true</b:terrain>" : ""}${p.terrainPending ? "<b:terrainPending>true</b:terrainPending>" : ""}</extensions>` : ""}</trkpt>`).join("\n")}\n</trkseg></trk></gpx>\n`;
}
export function validateWorkspace(value: unknown): value is Workspace {
  if (!value || typeof value !== "object") return false;
  const w = value as Workspace;
  if (
    w.version !== 1 ||
    !Array.isArray(w.tracks) ||
    w.tracks.length > 100 ||
    (w.routePlan !== undefined &&
      (!Array.isArray(w.routePlan) || w.routePlan.length > 500)) ||
    (w.confirmedPlan !== undefined &&
      (!Array.isArray(w.confirmedPlan) ||
        w.confirmedPlan.length > 500 ||
        !w.confirmedPlan.every(
          (id) => typeof id === "string" && /^[a-z0-9-]{1,64}$/i.test(id),
        ))) ||
    !w.selection ||
    !Number.isInteger(w.selection.start) ||
    !Number.isInteger(w.selection.end)
  )
    return false;
  if (w.inputOriginals !== undefined) {
    if (!Array.isArray(w.inputOriginals) || w.inputOriginals.length > 100)
      return false;
    const ids = new Set(w.tracks.map((track) => track?.id));
    if (
      new Set(w.inputOriginals.map((track) => track?.id)).size !==
        w.inputOriginals.length ||
      !w.inputOriginals.every((track) => track && ids.has(track.id)) ||
      !validateWorkspace({ ...emptyWorkspace(), tracks: w.inputOriginals })
    )
      return false;
  }
  let total = 0;
  const all = [
    ...w.tracks,
    ...(w.routePlan ?? []),
    ...(w.route ? [w.route] : []),
  ];
  return (
    all.every(
      (t) =>
        t &&
        typeof t.id === "string" &&
        /^[a-z0-9-]{1,64}$/i.test(t.id) &&
        typeof t.name === "string" &&
        typeof t.source === "string" &&
        (t.inputTrackId === undefined ||
          (typeof t.inputTrackId === "string" &&
            /^[a-z0-9-]{1,64}$/i.test(t.inputTrackId))) &&
        ["track", "route"].includes(t.kind) &&
        /^#[0-9a-f]{6}$/i.test(t.color) &&
        Array.isArray(t.points) &&
        t.points.length >= 2 &&
        (t.simplified === undefined || typeof t.simplified === "boolean") &&
        t.points.length <=
          (w.tracks.includes(t) ? MAX_INPUT_POINTS : MAX_POINTS) &&
        (total += t.points.length) <= MAX_INPUT_POINTS * 4 &&
        t.points.every(
          (p) =>
            p &&
            Number.isFinite(p.lat) &&
            Math.abs(p.lat) <= 90 &&
            Number.isFinite(p.lon) &&
            Math.abs(p.lon) <= 180 &&
            (p.ele === undefined || Number.isFinite(p.ele)) &&
            (p.time === undefined || typeof p.time === "string") &&
            (p.name === undefined || typeof p.name === "string") &&
            (p.gapBefore === undefined || typeof p.gapBefore === "boolean") &&
            (p.terrain === undefined || typeof p.terrain === "boolean") &&
            (p.terrainPending === undefined ||
              typeof p.terrainPending === "boolean"),
        ),
    ) &&
    (w.routePlan ?? []).reduce(
      (count, track) => count + track.points.length,
      0,
    ) <= MAX_POINTS &&
    (w.activeId === null ||
      [...w.tracks, ...(w.route ? [w.route] : [])].some(
        (t) => t.id === w.activeId,
      ))
  );
}

/** Retain all route data while migrating the shared-screen selection back to Edit. */
export function restoreSeparateWorkspace(saved: Workspace): Workspace {
  const workspace = structuredClone(saved);
  if (workspace.route?.name === "My joined route")
    workspace.route.name = "Edited Route";
  // Drop obsolete combined-app fields rather than carrying drawing state.
  const legacy = workspace as Workspace & {
    created?: unknown;
    createdTerrain?: unknown;
    tool?: unknown;
  };
  delete legacy.created;
  delete legacy.createdTerrain;
  delete legacy.tool;
  if (workspace.routePlan === undefined) {
    workspace.routePlan = workspace.route
      ? [
          section(
            workspace.route,
            { start: 0, end: workspace.route.points.length - 1 },
            workspace.route.name,
          ),
        ]
      : [];
    workspace.confirmedPlan = workspace.routePlan.map((track) => track.id);
  }
  return workspace;
}
