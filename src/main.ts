import "leaflet/dist/leaflet.css";
import "./style.css";
import { get, set } from "idb-keyval";
import { Capacitor } from "@capacitor/core";
import {
  analytics,
  emptyWorkspace,
  join,
  MAX_POINTS,
  parseGPX,
  reverse,
  section,
  selectedPoints,
  split,
  validateWorkspace,
  type Point,
  type Track,
  type Workspace,
  type Selection,
} from "./model";
import {
  pickFiles,
  saveTrack,
  isCancelled,
  NativeFiles,
  decode,
  type ImportFile,
} from "./files";
import { TrackMap, CreateMap } from "./map";
import { icon } from "./icons";
import { demoTracks } from "./demo";
import { enrichTerrain } from "./terrain";
import { getDevicePosition, locationError } from "./location";
let locating = false;
import {
  coordinateSystems,
  formatCoordinate,
  isCoordinateSystem,
  type CoordinateSystem,
} from "./coordinates";
let coordinateSystem: CoordinateSystem = "latlon";
const COORDINATE_KEY = "baregps-coordinate-system-v1";

const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const km = (n: number) =>
  (n / 1000).toLocaleString("en-IE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const metres = (n: number) => Math.round(n).toLocaleString("en-IE");
let workspace = emptyWorkspace(),
  undo: Workspace[] = [],
  redo: Workspace[] = [];
let showAll = true,
  expanded = false,
  busy = false,
  saveTimer: ReturnType<typeof setTimeout>,
  saveQueue = Promise.resolve();
let terrainController: AbortController | null = null;
import {
  newCreatedRoute,
  insertWaypoint,
  moveWaypoint,
  removeWaypoint,
  closeRoute,
  isClosedRoute,
  type DrawingMode,
} from "./create";
let drawingMode: DrawingMode = "add";
let mode: "edit" | "create" = "create";
let createMapOpened = true;
type CreatedSnapshot = { route: Track; terrain?: Track };
let createUndo: CreatedSnapshot[] = [],
  createRedo: CreatedSnapshot[] = [];
const draft = () => (workspace.created ??= newCreatedRoute());
const createdTrack = () => workspace.createdTerrain ?? draft();
const visibleMap = () => (mode === "create" ? createMap : map);
const STORAGE_KEY = "baregps-workspace-v1";

document.querySelector("#app")!.innerHTML = `
<header class="app-header"><a class="brand" href="#" aria-label="BareGPS Route Planner home"><img src="${import.meta.env.BASE_URL}logo.svg" alt="" width="40" height="40"><span class="brand-copy"><strong class="brand-title">BareGPS Route Planner</strong><span class="brand-subtitle">GPX Creator and Editor</span></span></a><div class="header-right"><div class="device-status"><span id="save-state" class="save-state" role="status" title="Your workspace is kept on this device. Use Save section or Save route to export a GPX file."><span class="save-full">On your device</span><span class="save-short" aria-hidden="true">On device</span></span><div class="history" role="group" aria-label="Edit history"><button id="undo" class="icon-button" aria-label="Undo" title="Undo (⌘/Ctrl Z)">${icon("undo", 18)}</button><button id="redo" class="icon-button" aria-label="Redo" title="Redo (⌘/Ctrl Shift Z)">${icon("redo", 18)}</button></div></div><div class="header-utilities"><button id="help" class="icon-button" aria-label="Help and keyboard shortcuts">${icon("help")}</button><button id="settings" class="icon-button" aria-label="Settings" title="Settings">${icon("settings", 19)}</button></div></div></header>
<main>
  <span id="track-count" class="sr-only">Your workspace</span>
  <section id="map-panel" class="map-panel" aria-label="Track map">
    <div class="mode-tabs" role="tablist" aria-label="Route workspace"><button id="create-tab" role="tab" aria-selected="true" aria-controls="create-map-view">Create</button><button id="edit-tab" role="tab" aria-selected="false" aria-controls="edit-map-view" tabindex="-1">Edit</button><span id="mode-caption">Work with your GPX tracks</span></div>
    <div class="map-toolbar"><span class="map-label">${icon("mountain", 18)}<strong>OpenTopoMap</strong><span class="terrain-label">TERRAIN</span></span><div class="map-actions"><button id="view-toggle" class="small-button">${icon("eye", 16)}<span>All tracks</span></button><span class="toolbar-divider"></span><button id="fit" class="icon-button" aria-label="Fit tracks to map" title="Fit tracks">${icon("fit", 18)}</button><button id="expand" class="icon-button" aria-label="Expand map" title="Expand map">${icon("expand", 18)}</button></div></div>
    <div id="create-tools" class="create-tools" role="group" aria-label="Route drawing controls" hidden><div class="drawing-modes" role="group" aria-label="Drawing mode"><button id="draw-add" aria-pressed="true">Add points</button><button id="draw-insert" aria-pressed="false">Insert point</button></div><button id="create-close" class="small-button">Close loop</button></div>
    <div id="edit-map-view" role="tabpanel" aria-labelledby="edit-tab"><div id="map"></div><button id="edit-locate" class="icon-button map-locate" aria-label="Go to current position" title="Go to current position">${icon("locate", 21)}</button><span id="edit-coordinates" class="map-coordinates" aria-label="Map centre coordinates"></span></div>
    <div id="create-map-view" role="tabpanel" aria-labelledby="create-tab" hidden><div id="create-map" aria-label="Create a walking route"></div><button id="create-locate" class="icon-button map-locate" aria-label="Go to current position" title="Go to current position">${icon("locate", 21)}</button><span id="create-coordinates" class="map-coordinates" aria-label="Map centre coordinates"></span><p class="create-map-hint" id="create-map-hint">Tap the map to place your starting point.</p></div>
    <div id="map-empty" class="map-empty"><button id="empty-import" class="button primary">${icon("plus", 18)}Open GPX files</button><button id="demo" class="text-button">Explore with sample tracks ${icon("chevron", 14)}</button></div>
    <div id="create-map-error" class="map-error" hidden>Map tiles couldn’t load. You can still shape and save your route.<button id="retry-create-map" class="text-button">Retry</button></div>
    <div id="map-error" class="map-error" hidden>Map tiles couldn’t load. Your tracks and editing are still available.<button id="retry-map" class="text-button">Retry</button></div>
    <div class="map-legend" id="map-legend" hidden><span><i class="legend-solid"></i>Recorded track</span><span><i class="legend-dashed"></i>Walking connection</span></div>
  </section>
  <section id="analytics" class="analytics" aria-label="Live track analytics"><div class="metric"><span>${icon("route", 17)} Distance(km)</span><strong id="distance">0.00</strong></div><div class="metric"><span>${icon("up", 17)} Ascent(m)</span><strong id="ascent">—</strong></div><div class="metric"><span>${icon("down", 17)} Descent(m)</span><strong id="descent">—</strong></div><div class="metric selection-metric"><span>${icon("pin", 17)} <span id="selection-caption">SELECTED SECTION</span></span><strong id="point-count">No track selected</strong><span id="analytics-source" class="metric-note">Open a file to begin</span></div></section>
  <section class="profile-card" aria-label="Elevation profile"><div class="profile-heading"><span>ELEVATION PROFILE</span><span id="profile-range">Select a track to explore its elevation</span></div><div id="profile"></div><div id="elevation-note" class="elevation-note" hidden></div></section>
  <div id="editor" class="editor-grid">
    <section class="card tracks-card"><div class="card-heading"><h2>Your tracks <span id="source-count" class="badge">0</span></h2><button id="import" class="button secondary compact">${icon("plus", 16)}Open files</button></div><div id="track-list" class="track-list"></div><div class="card-footnote"><span>${icon("file", 14)} GPX files · originals stay untouched</span></div></section>
    <section class="card section-card"><div class="card-heading"><h2>Edit a section</h2><span class="badge soft">A → B</span></div><div id="section-controls"></div></section>
  </div>
  <section id="route-card" class="route-card"></section>
  <section id="create-card" class="card create-card" aria-label="Created route waypoints" hidden>
    <div class="card-heading"><h2>Your new route <span id="waypoint-count" class="badge">0</span></h2><span class="badge soft">TAP → SHAPE → SAVE</span></div>
    <div class="create-settings"><label>Route name<input id="create-name" class="text-input" maxlength="120" value="My walking route"></label><label class="line-color">Line colour<input id="create-color" type="color" value="#16724d"></label></div>
    <div class="waypoint-scroll" role="region" aria-label="Route points" tabindex="0"><table class="waypoint-table"><caption class="sr-only">Route points in walking order</caption><thead><tr><th scope="col">Point</th><th id="coordinate-heading" scope="col" colspan="2">Lat/Long (WGS84)</th><th scope="col">Leg</th><th scope="col">Total</th><th scope="col">Height</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody id="waypoint-rows"></tbody></table></div>
    <div class="create-buttons"><button id="create-terrain" class="button secondary">${icon("mountain", 17)}Fetch terrain</button><button id="create-clear" class="button secondary">${icon("trash", 17)}Clear route</button><button id="create-save" class="button primary">${icon("export", 17)}Save route</button></div>
  </section>
  <footer><span>Your files stay on your device. Map & terrain requests use the internet.</span></footer>
</main>
<div id="notice" class="notice" role="status" hidden></div>
<dialog id="dialog"><div id="dialog-content"></div></dialog>
`;
const map = new TrackMap(updateSelection, () => {
  $("map-error").hidden = false;
});
const createMap = new CreateMap(
  (index, point) => {
    if (
      changeCreated(() => insertWaypoint(draft(), index, point)) &&
      drawingMode === "insert"
    ) {
      drawingMode = "add";
      render();
    }
  },
  (index, point) => {
    changeCreated(() => moveWaypoint(draft(), index, point));
    renderMap();
  },
  (index, point) => {
    const preview = {
      ...draft(),
      points: draft().points.map((p, i) =>
        i === index ? point : { lat: p.lat, lon: p.lon },
      ),
    };
    renderStats(preview);
  },
  () => {
    $("create-map-error").hidden = mode !== "create";
  },
);
for (const [name, view] of [
  ["edit", map],
  ["create", createMap],
] as const) {
  view.map.on("moveend", () => updateMapCoordinates(name, view));
}
function updateMapCoordinates(name: string, view: TrackMap) {
  const centre = view.map.getCenter().wrap();
  $(name + "-coordinates").textContent =
    `Centre · ${formatCoordinate({ lat: centre.lat, lon: centre.lng }, coordinateSystem)}`;
  $(name + "-coordinates").title = coordinateSystems[coordinateSystem];
}
for (const name of ["edit", "create"])
  $(name + "-locate").onclick = goToCurrentPosition;
function renderLocationButtons() {
  for (const name of ["edit", "create"]) {
    const button = $<HTMLButtonElement>(name + "-locate");
    button.disabled = locating;
    button.setAttribute("aria-busy", String(locating));
    button.setAttribute(
      "aria-label",
      locating ? "Finding current position" : "Go to current position",
    );
  }
}
async function goToCurrentPosition() {
  if (locating) return;
  locating = true;
  renderLocationButtons();
  try {
    const point = await getDevicePosition();
    const target = visibleMap();
    target.showPosition(point, true);
    (target === map ? createMap : map).showPosition(point, false);
    notification(
      `Current position found · reported accuracy ±${Math.round(point.accuracy)} m`,
    );
  } catch (error) {
    notification(locationError(error), true);
  } finally {
    locating = false;
    renderLocationButtons();
  }
}
const active = () =>
  [...workspace.tracks, ...(workspace.route ? [workspace.route] : [])].find(
    (t) => t.id === workspace.activeId,
  ) ?? null;
const allTracks = () => [
  ...workspace.tracks,
  ...(workspace.route ? [workspace.route] : []),
];
function notification(message: string, error = false) {
  const el = $("notice");
  el.className = `notice ${error ? "error" : ""}`;
  el.setAttribute("role", error ? "alert" : "status");
  el.innerHTML = `${icon(error ? "info" : "check", 18)}<span>${esc(message)}</span><button class="icon-button" aria-label="Dismiss message">${icon("close", 16)}</button>`;
  el.hidden = false;
  el.querySelector("button")!.onclick = () => {
    el.hidden = true;
  };
}
function report(error: unknown) {
  if (isCancelled(error)) return;
  console.error(error);
  notification(
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String(error.message)
        : "Something went wrong. Your tracks are safe. Please try again.",
    true,
  );
}
function setSaveState(full: string, short: string) {
  $("save-state").innerHTML =
    `<span class="save-full">${full}</span><span class="save-short" aria-hidden="true">${short}</span>`;
  $("save-state").setAttribute("aria-label", full);
  $("save-state").title =
    `${full}. This refers to the workspace on this device; use Save section or Save route to export a GPX file.`;
}
let storageRevision = 0;
function flushWorkspace() {
  clearTimeout(saveTimer);
  const snapshot = structuredClone(workspace),
    revision = storageRevision;
  saveQueue = saveQueue
    .catch(() => {})
    .then(() => set(STORAGE_KEY, snapshot))
    .then(() => {
      if (revision === storageRevision)
        setSaveState("Saved on device", "Saved");
    })
    .catch(() => {
      setSaveState("Not saved", "Not saved");
      notification(
        "Your device could not save this workspace. Export your tracks before closing the app.",
        true,
      );
    });
}
function persist() {
  storageRevision++;
  clearTimeout(saveTimer);
  setSaveState("Saving…", "Saving…");
  saveTimer = setTimeout(flushWorkspace, 300);
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && storageRevision > 0)
    flushWorkspace();
});
function boundHistory() {
  let points = 0;
  for (let i = undo.length - 1; i >= 0; i--) {
    points +=
      undo[i].tracks.reduce((n, t) => n + t.points.length, 0) +
      (undo[i].route?.points.length ?? 0);
    if (i < undo.length - 1 && (points > 1000000 || undo.length - i > 20)) {
      undo.splice(0, i + 1);
      break;
    }
  }
}
function checkpoint() {
  undo.push(structuredClone(workspace));
  boundHistory();
  redo = [];
}
function commit(action: () => void, fit = false): boolean {
  if (busy) return false;
  const before = structuredClone(workspace);
  try {
    action();
    undo.push(before);
    boundHistory();
    redo = [];
    persist();
    render();
    if (fit) fitMap();
    return true;
  } catch (e) {
    workspace = before;
    report(e);
    return false;
  }
}
function replace(track: Track) {
  if (workspace.route?.id === track.id) workspace.route = track;
  else
    workspace.tracks = workspace.tracks.map((t) =>
      t.id === track.id ? track : t,
    );
}
function select(track: Track) {
  workspace.activeId = track.id;
  workspace.selection = { start: 0, end: track.points.length - 1 };
  persist();
  render();
  fitMap();
}
function fitMap() {
  if (mode === "create") {
    createMap.fit([draft()]);
    return;
  }
  const t = active();
  map.fit(
    showAll ? allTracks() : t ? [t] : [],
    showAll ? undefined : workspace.selection,
  );
}
function updateSelection(selection: Selection) {
  const t = active();
  if (!t || busy) return;
  workspace.selection = {
    start: Math.max(
      0,
      Math.min(selection.end - 1, t.points.length - 2, selection.start),
    ),
    end: Math.max(
      1,
      selection.start + 1,
      Math.min(t.points.length - 1, selection.end),
    ),
  };
  const { start, end } = workspace.selection;
  const a = $<HTMLInputElement>("range-start"),
    b = $<HTMLInputElement>("range-end");
  if (a) {
    a.value = String(start);
    b.value = String(end);
    $("start-label").textContent = `Point ${start + 1}`;
    $("end-label").textContent = `Point ${end + 1}`;
    $("selected-label").textContent =
      `${end - start + 1} of ${t.points.length} points`;
    $("range-fill").style.left = `${(start / (t.points.length - 1)) * 100}%`;
    $("range-fill").style.right =
      `${100 - (end / (t.points.length - 1)) * 100}%`;
  }
  renderStats();
  renderMap();
  persist();
}
function renderMap() {
  if (mode === "create") {
    createMap.enabled = !busy;
    createMap.drawingMode = drawingMode;
    createMap.renderCreated(draft());
    $("map-empty").hidden = true;
    $("map-legend").hidden = true;
    return;
  }
  map.render(allTracks(), active(), workspace.selection, showAll);
  $("map-empty").hidden = allTracks().length > 0;
  $("map-legend").hidden = !allTracks().length;
}
function renderStats(preview?: Track) {
  const t = mode === "create" ? (preview ?? createdTrack()) : active(),
    points =
      mode === "create"
        ? t!.points
        : t
          ? selectedPoints(t, workspace.selection)
          : [],
    a = analytics(points);
  $("distance").innerHTML = `${km(a.length)}`;
  const hasElevation = points.some((p) => p.ele !== undefined);
  $("ascent").innerHTML =
    `${hasElevation ? metres(a.ascent) : "—"}${hasElevation && (mode === "create" || a.missingEdges || a.estimatedGap) ? "<sup>est.</sup>" : ""}`;
  $("descent").innerHTML = `${hasElevation ? metres(a.descent) : "—"}`;
  $("point-count").textContent =
    mode === "create"
      ? `${draft().points.length.toLocaleString()} waypoints`
      : t
        ? `${points.length.toLocaleString()} points`
        : "No track selected";
  $("analytics-source").textContent = t
    ? a.gapDistance
      ? `Includes ${km(a.gapDistance)} km of connections`
      : mode === "create"
        ? workspace.createdTerrain && !preview
          ? "Terrain estimate · entire route"
          : "Straight-line route · live totals"
        : "Selected section · live totals"
    : "Open a file to begin";
  $("profile-range").textContent = hasElevation
    ? `${metres(a.min!)}–${metres(a.max!)} m · ${t!.name}`
    : t
      ? mode === "create"
        ? "Fetch terrain to see route elevation"
        : "No elevation data in this section"
      : "Select a track to explore its elevation";
  const note = $("elevation-note");
  note.hidden = !(a.missingEdges || a.estimatedGap);
  note.textContent =
    mode === "create" && !hasElevation
      ? "Ascent and descent are unavailable until terrain is fetched. Distance includes every route leg."
      : a.missingEdges
        ? "Elevation is missing for some points. Ascent and descent are partial; distance includes the entire section."
        : a.estimatedGap
          ? "Connection distance is included. Connection ascent uses endpoint heights until you fetch terrain; intermediate hills may be missed."
          : "";
  const profile = $("profile");
  if (!hasElevation) {
    profile.innerHTML =
      '<div class="profile-empty">' +
      (t
        ? mode === "create"
          ? "Add points, then fetch terrain for estimated ascent."
          : "This GPX has no elevation data. Distance is still available."
        : "Your elevation profile will appear here.") +
      "</div>";
    return;
  }
  const width = 1000,
    height = 70,
    min = a.min!,
    span = Math.max(20, a.max! - min);
  let cumulative = 0;
  const coords = points.map((p, i) => {
    if (i) cumulative += analyticsDistance(points[i - 1], p);
    return {
      x: a.length ? (cumulative / a.length) * width : 0,
      y:
        p.ele === undefined
          ? null
          : height - 8 - ((p.ele - min) / span) * (height - 16),
      gap: !!p.gapBefore,
    };
  });
  // Preserve missing elevation gaps and dashed walking connectors in the chart.
  let paths = "",
    area = "",
    current = "",
    gapPaths = "";
  coords.forEach((p, i) => {
    if (p.y === null) {
      current = "";
      return;
    }
    const prev = coords[i - 1];
    if (prev?.y !== null && prev && p.gap)
      gapPaths += `M${prev.x.toFixed(1)},${prev.y!.toFixed(1)}L${p.x.toFixed(1)},${p.y.toFixed(1)} `;
    const cmd = current && !p.gap ? "L" : "M";
    current = `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    paths += `${cmd}${current} `;
  });
  if (!a.missingEdges)
    area = `${paths.replace(/M/g, "L").replace(/^L/, "M")} L1000,70 L0,70 Z`;
  profile.innerHTML = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Elevation profile, ${metres(min)} to ${metres(a.max!)} metres"><defs><linearGradient id="profile-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${t!.color}" stop-opacity=".18"/><stop offset="100%" stop-color="${t!.color}" stop-opacity=".015"/></linearGradient></defs><path d="M0 23H1000M0 47H1000" stroke="#e9ede6" stroke-dasharray="3 5"/>${area ? `<path d="${area}" fill="url(#profile-fill)"/>` : ""}<path d="${paths}" fill="none" stroke="${t!.color}" stroke-width="2" vector-effect="non-scaling-stroke"/><path d="${gapPaths}" fill="none" stroke="${t!.color}" stroke-width="2" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"/></svg><div class="profile-axis"><span>0 km</span><span>${km(a.length)} km</span></div>`;
}
import { distance as analyticsDistance } from "./model";
function renderTracks() {
  $("source-count").textContent = String(workspace.tracks.length);
  $("track-count").textContent = allTracks().length
    ? `${workspace.tracks.length} ${workspace.tracks.length === 1 ? "track" : "tracks"} in workspace`
    : "Your workspace";
  const list = $("track-list");
  list.innerHTML = workspace.tracks.length
    ? workspace.tracks
        .map((t) => {
          const a = analytics(t.points);
          return `<div class="track-row ${t.id === workspace.activeId ? "active" : ""}"><button class="track-select" data-id="${t.id}" aria-pressed="${t.id === workspace.activeId}"><span class="track-symbol" style="--track-color:${t.color}">${icon("route", 20)}</span><span class="track-text"><strong>${esc(t.name)}</strong><small>${km(a.length)} km <span>·</span> ${t.points.some((p) => p.ele !== undefined) ? `${metres(a.ascent)} m ↗` : "No elevation"} <span>·</span> ${t.points.length.toLocaleString()} pts</small></span>${t.id === workspace.activeId ? '<span class="active-dot"></span>' : icon("chevron", 15)}</button><button class="icon-button delete-track" data-id="${t.id}" aria-label="Remove ${esc(t.name)}" title="Remove track">${icon("trash", 16)}</button></div>`;
        })
        .join("")
    : '<div class="tracks-empty">' +
      icon("file", 28) +
      "<strong>A home for your tracks</strong><p>Open one or more GPX files.<br>Choose a track to start shaping your route.</p></div>";
  list.querySelectorAll<HTMLButtonElement>(".track-select").forEach(
    (b) =>
      (b.onclick = () => {
        if (!busy) select(workspace.tracks.find((t) => t.id === b.dataset.id)!);
      }),
  );
  list.querySelectorAll<HTMLButtonElement>(".delete-track").forEach(
    (b) =>
      (b.onclick = () =>
        commit(() => {
          workspace.tracks = workspace.tracks.filter(
            (t) => t.id !== b.dataset.id,
          );
          if (workspace.activeId === b.dataset.id) {
            const next = workspace.tracks[0] ?? workspace.route;
            workspace.activeId = next?.id ?? null;
            workspace.selection = {
              start: 0,
              end: next ? next.points.length - 1 : 0,
            };
          }
        })),
  );
}
function renderControls() {
  const t = active(),
    box = $("section-controls");
  if (!t) {
    box.innerHTML =
      '<div class="controls-empty"><span class="selection-preview"><i>A</i><span></span><i>B</i></span><h3>Keep the good bits.</h3><p>Drag the A and B handles on the map to choose a section. Then save it, split it, or add it to your joined route.</p></div>';
    return;
  }
  const { start, end } = workspace.selection;
  box.innerHTML = `<div class="selected-title"><span class="eyebrow">${t.kind === "route" ? "JOINED ROUTE" : "SELECTED TRACK"}</span><button id="rename" class="name-button" title="Rename track">${esc(t.name)}${icon("edit", 14)}</button></div>
  <div class="selection-settings"><div class="selection-slider"><div class="selection-labels"><span><i class="endpoint">A</i> Start <strong id="start-label">Point ${start + 1}</strong></span><span><i class="endpoint">B</i> End <strong id="end-label">Point ${end + 1}</strong></span></div>
  <div class="range-track"><div id="range-fill" style="left:${(start / (t.points.length - 1)) * 100}%;right:${100 - (end / (t.points.length - 1)) * 100}%"></div><input id="range-start" type="range" min="0" max="${t.points.length - 1}" value="${start}" aria-label="Section start point"><input id="range-end" type="range" min="0" max="${t.points.length - 1}" value="${end}" aria-label="Section end point"></div>
  <div class="range-caption"><span id="selected-label">${end - start + 1} of ${t.points.length} points</span><button id="reset-selection" class="text-button">Select whole track</button></div>
  </div><label class="line-color">Line colour<input id="track-color" type="color" value="${t.color}"></label></div>
  <div class="edit-buttons"><button id="save-section" class="button secondary">${icon("export", 16)}Save section</button><button id="split" class="button secondary" ${end - start < 2 ? "disabled" : ""}>${icon("scissors", 16)}Split</button><button id="reverse" class="button secondary" title="Reverse the whole track">${icon("reverse", 16)}Reverse</button></div>
  ${t.kind !== "route" ? `<button id="add-route" class="button primary full">${icon("join", 18)}${workspace.route ? "Append section to route" : "Start joined route with section"}</button>` : '<button id="save-copy" class="button primary full">' + icon("plus", 18) + "Keep section as a new track</button>"}
  <p class="control-hint">Drag map handles or use the sliders. Originals are never overwritten.</p>`;
  $<HTMLInputElement>("range-start").oninput = (e) =>
    updateSelection({
      ...workspace.selection,
      start: Math.min(
        workspace.selection.end - 1,
        Number((e.target as HTMLInputElement).value),
      ),
    });
  $<HTMLInputElement>("range-end").oninput = (e) =>
    updateSelection({
      ...workspace.selection,
      end: Math.max(
        workspace.selection.start + 1,
        Number((e.target as HTMLInputElement).value),
      ),
    });
  $("reset-selection").onclick = () => {
    updateSelection({ start: 0, end: t.points.length - 1 });
    fitMap();
  };
  $("rename").onclick = () => rename(t);
  $("save-section").onclick = () =>
    exportTrack(
      section(
        t,
        workspace.selection,
        workspace.selection.start === 0 &&
          workspace.selection.end === t.points.length - 1
          ? t.name
          : undefined,
      ),
    );
  $("split").onclick = () => splitDialog(t);
  $("reverse").onclick = () =>
    commit(() => {
      replace(reverse(t));
      workspace.selection = {
        start: t.points.length - 1 - end,
        end: t.points.length - 1 - start,
      };
    });
  $("add-route")?.addEventListener("click", () => {
    if (
      commit(() => {
        workspace.route = join(workspace.route, t, workspace.selection);
        ensureTrackCapacity(0, 0);
      })
    ) {
      notification(
        "Section added to your joined route. Choose another track to keep building.",
      );
    }
  });
  $("save-copy")?.addEventListener("click", () =>
    commit(() => {
      ensureTrackCapacity(1, end - start + 1);
      workspace.tracks.push(section(t, workspace.selection));
    }),
  );
  $<HTMLInputElement>("track-color").onchange = (e) =>
    commit(() =>
      replace({ ...t, color: (e.target as HTMLInputElement).value }),
    );
}
function renderRoute() {
  const route = workspace.route,
    card = $("route-card");
  if (!route) {
    card.innerHTML = "";
    return;
  }
  const a = analytics(route.points);
  card.innerHTML = `<div class="route-summary"><span class="route-empty-icon">${icon("join", 26)}</span><div><span class="eyebrow">YOUR JOINED ROUTE</span><button id="rename-route" class="name-button">${esc(route.name)} ${icon("edit", 14)}</button><p>${km(a.length)} km <span>·</span> ${route.points.some((p) => p.ele !== undefined) ? `${metres(a.ascent)} m ascent${a.estimatedGap || a.missingEdges ? " (estimated)" : ""}` : "Elevation unavailable"}${a.gapDistance ? ` <span>·</span> ${km(a.gapDistance)} km of walking connections` : ""}</p></div></div><div class="route-buttons">${a.estimatedGap ? '<button id="terrain" class="button secondary">' + icon("mountain", 17) + "Fetch gap terrain</button>" : ""}<button id="preview-route" class="button secondary">${icon("eye", 17)}Preview</button><button id="export-route" class="button primary">${icon("export", 17)}Save route</button><button id="remove-route" class="icon-button" aria-label="Remove joined route">${icon("trash", 17)}</button></div>`;
  $("rename-route").onclick = () => rename(route);
  $("preview-route").onclick = () => {
    showAll = false;
    select(route);
    $("map-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  };
  $("export-route").onclick = () => exportTrack(route);
  $("remove-route").onclick = () =>
    commit(() => {
      workspace.route = null;
      if (workspace.activeId === route.id) {
        workspace.activeId = workspace.tracks[0]?.id ?? null;
        workspace.selection = {
          start: 0,
          end: workspace.tracks[0]?.points.length
            ? workspace.tracks[0].points.length - 1
            : 0,
        };
      }
    });
  $("terrain")?.addEventListener("click", terrainDialog);
}
function render() {
  renderTracks();
  renderControls();
  renderRoute();
  renderMode();
  if (mode === "create") renderCreated();
  renderStats();
  renderMap();
  $<HTMLButtonElement>("undo").disabled =
    !(mode === "create" ? createUndo : undo).length || busy;
  $<HTMLButtonElement>("redo").disabled =
    !(mode === "create" ? createRedo : redo).length || busy;
  $("view-toggle").innerHTML =
    `${icon("eye", 16)}<span>${showAll ? "All tracks" : "Selected section"}</span>`;
  for (const id of [
    "import",
    "empty-import",
    "demo",
    "view-toggle",
    "edit-tab",
    "create-tab",
  ])
    $<HTMLButtonElement>(id).disabled = busy;
  document.querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
    if (
      busy &&
      !b.closest("#dialog") &&
      !b.closest("#notice") &&
      !["expand", "help", "retry-map", "retry-create-map", "fit"].includes(b.id)
    )
      b.disabled = true;
  });
  renderLocationButtons();
}
function ensureTrackCapacity(count: number, points: number) {
  if (workspace.tracks.length + count > 100)
    throw new Error(
      "The workspace can hold 100 tracks. Remove some tracks before adding more.",
    );
  if (
    allTracks().reduce((n, t) => n + t.points.length, 0) + points >
    MAX_POINTS * 3
  )
    throw new Error(
      "This workspace is full. Export and remove some tracks before importing more.",
    );
}
async function importFiles(files?: ImportFile[]) {
  if (busy) return;
  busy = true;
  render();
  try {
    const incoming = files ?? (await pickFiles());
    if (!incoming.length) return;
    if (incoming.length > 20)
      throw new Error("Choose up to 20 GPX files at a time.");
    const tracks: Track[] = [],
      errors: string[] = [];
    for (const file of incoming) {
      try {
        const parsed = parseGPX(file.text, file.name);
        ensureTrackCapacity(
          tracks.length + parsed.length,
          tracks.reduce((n, t) => n + t.points.length, 0) +
            parsed.reduce((n, t) => n + t.points.length, 0),
        );
        tracks.push(...parsed);
      } catch (e) {
        errors.push(
          `${file.name}: ${e instanceof Error ? e.message : "Could not read file."}`,
        );
      }
    }
    ensureTrackCapacity(
      tracks.length,
      tracks.reduce((n, t) => n + t.points.length, 0),
    );
    if (tracks.length) {
      checkpoint();
      workspace.tracks.push(...tracks);
      mode = "edit";
      workspace.activeId = tracks[0].id;
      workspace.selection = { start: 0, end: tracks[0].points.length - 1 };
      persist();
    }
    if (errors.length)
      notification(
        `${tracks.length ? `${tracks.length} tracks imported. ` : ""}${errors.join(" ")}`,
        true,
      );
    else
      notification(
        `${tracks.length} ${tracks.length === 1 ? "track" : "tracks"} imported. Choose a section to start editing.`,
      );
  } catch (e) {
    report(e);
  } finally {
    busy = false;
    render();
    fitMap();
  }
}
async function exportTrack(track: Track) {
  if (busy) return;
  busy = true;
  render();
  try {
    if (await saveTrack(track))
      notification(
        Capacitor.isNativePlatform()
          ? "GPX saved to your chosen location."
          : "GPX saved. Your workspace is still here.",
      );
  } catch (e) {
    report(e);
  } finally {
    busy = false;
    render();
  }
}
function openDialog(content: string) {
  $("dialog-content").innerHTML = content;
  $<HTMLDialogElement>("dialog").showModal();
  $("dialog-content")
    .querySelectorAll("[data-close]")
    .forEach((b) =>
      b.addEventListener("click", () => $<HTMLDialogElement>("dialog").close()),
    );
}
function dialogHeader(title: string, subtitle = "", branded = false) {
  return `<div class="dialog-heading${branded ? " branded-dialog-heading" : ""}"><div class="dialog-heading-content">${branded ? `<img class="dialog-logo" src="${import.meta.env.BASE_URL}logo.svg" alt="BareGPS" width="36" height="36">` : ""}<div><h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ""}</div></div><button class="icon-button" data-close aria-label="Close dialog">${icon("close", 20)}</button></div>`;
}
function rename(track: Track) {
  openDialog(
    `${dialogHeader("Give your track a name")}<form id="rename-form"><label class="field-label" for="track-name">Track name</label><input id="track-name" class="text-input" maxlength="120" value="${esc(track.name)}" required><div class="dialog-actions"><button type="button" class="button secondary" data-close>Cancel</button><button class="button primary">Save name</button></div></form>`,
  );
  $("rename-form").onsubmit = (e) => {
    e.preventDefault();
    const name = $<HTMLInputElement>("track-name").value.trim();
    if (!name) return;
    commit(() => replace({ ...track, name }));
    $<HTMLDialogElement>("dialog").close();
  };
  $<HTMLInputElement>("track-name").select();
}
function splitDialog(track: Track) {
  const { start, end } = workspace.selection;
  if (end - start < 2) return;
  openDialog(
    `${dialogHeader("Split the selected section", "Choose the shared point where one track becomes two.")}<label class="field-label" for="split-point">Split at <strong id="split-label"></strong></label><input id="split-point" class="single-range" type="range" min="${start + 1}" max="${end - 1}" value="${Math.floor((start + end) / 2)}"><div id="split-summary" class="split-summary"></div><p class="dialog-note">Both new tracks include the split point. Your original track stays in the workspace.</p><div class="dialog-actions"><button class="button secondary" data-close>Cancel</button><button id="confirm-split" class="button primary">${icon("scissors", 17)}Split into two tracks</button></div>`,
  );
  const update = () => {
    const point = Number($<HTMLInputElement>("split-point").value);
    $("split-label").textContent = `point ${point + 1}`;
    $("split-summary").innerHTML =
      `<span>First section<strong>${km(analytics(track.points.slice(start, point + 1)).length)} km</strong></span><span>Second section<strong>${km(analytics(track.points.slice(point, end + 1)).length)} km</strong></span>`;
  };
  $<HTMLInputElement>("split-point").oninput = update;
  update();
  $("confirm-split").onclick = () => {
    commit(() => {
      const cropped = section(track, workspace.selection, track.name);
      const parts = split(
        cropped,
        Number($<HTMLInputElement>("split-point").value) - start,
      );
      ensureTrackCapacity(2, cropped.points.length + 1);
      workspace.tracks.push(...parts);
      workspace.activeId = parts[0].id;
      workspace.selection = { start: 0, end: parts[0].points.length - 1 };
    }, true);
    $<HTMLDialogElement>("dialog").close();
  };
}
function terrainDialog() {
  if (!workspace.route || busy) return;
  openDialog(
    `${dialogHeader("Count the hills between tracks", "Include terrain along your dashed walking connections.")}<p>We’ll sample heights about every 90 metres along each straight connection using Open Topo Data. Connection coordinates are sent to that service.</p><p>These are terrain estimates, not a routed footpath. Distance and ascent include all connections. Keep the connection only if it follows the way you plan to walk.</p><div class="dialog-actions"><button class="button secondary" data-close>Cancel</button><button id="confirm-terrain" class="button primary">${icon("mountain", 17)}Fetch terrain heights</button></div>`,
  );
  $("confirm-terrain").onclick = async () => {
    const route = workspace.route!;
    busy = true;
    terrainController = new AbortController();
    render();
    $("dialog-content").innerHTML =
      `${dialogHeader("Fetching connection terrain")}<p id="terrain-progress" role="status">Preparing samples…</p><div class="dialog-actions"><button id="cancel-terrain" class="button secondary">Cancel</button></div>`;
    const cancel = () => terrainController?.abort();
    $("cancel-terrain").onclick = cancel;
    $<HTMLDialogElement>("dialog").oncancel = cancel;
    try {
      const enriched = await enrichTerrain(
        route,
        (s) => {
          $("terrain-progress").textContent = s;
        },
        terrainController.signal,
      );
      ensureTrackCapacity(0, enriched.points.length - route.points.length);
      checkpoint();
      workspace.route = enriched;
      if (workspace.activeId === route.id)
        workspace.selection = { start: 0, end: enriched.points.length - 1 };
      persist();
      notification(
        "Connection terrain included in route ascent. Heights are terrain estimates.",
      );
    } catch (e) {
      report(e);
    } finally {
      busy = false;
      terrainController = null;
      $<HTMLDialogElement>("dialog").oncancel = null;
      $<HTMLDialogElement>("dialog").close();
      render();
    }
  };
}
function createdSnapshot(): CreatedSnapshot {
  return structuredClone({ route: draft(), terrain: workspace.createdTerrain });
}
function restoreCreated(snapshot: CreatedSnapshot) {
  workspace.created = snapshot.route;
  workspace.createdTerrain = snapshot.terrain;
}
function changeCreated(change: () => Track) {
  if (busy) return false;
  try {
    const before = createdSnapshot(),
      route = change();
    createUndo.push(before);
    if (createUndo.length > 30) createUndo.shift();
    createRedo = [];
    workspace.created = route;
    workspace.createdTerrain = undefined;
    persist();
    render();
    return true;
  } catch (error) {
    report(error);
    render();
    return false;
  }
}
function setMode(next: "edit" | "create") {
  if (busy || mode === next) return;
  const firstCreate = next === "create" && !createMapOpened;
  if (next === "create") createMapOpened = true;
  mode = next;
  drawingMode = "add";
  render();
  requestAnimationFrame(() => {
    visibleMap().map.invalidateSize({ pan: false });
    if (firstCreate) {
      if (draft().points.length) createMap.fit([draft()]);
      else createMap.home();
    }
  });
}
function renderMode() {
  const creating = mode === "create";
  updateMapCoordinates("edit", map);
  updateMapCoordinates("create", createMap);
  document.body.classList.toggle("creating", creating);
  $("edit-map-view").hidden = creating;
  $("create-map-view").hidden = !creating;
  $("editor").hidden = creating;
  $("route-card").hidden = creating || !workspace.route;
  $("create-card").hidden = !creating;
  $("create-tools").hidden = !creating;
  $("view-toggle").hidden = creating;
  $("selection-caption").textContent = creating
    ? "CREATED ROUTE"
    : "SELECTED SECTION";
  $("mode-caption").textContent = creating
    ? "Make a route, one point at a time"
    : "Work with your GPX tracks";
  $("map-panel").setAttribute(
    "aria-label",
    creating ? "Create route map" : "Track map",
  );
  for (const name of ["edit", "create"]) {
    $(name + "-tab").setAttribute("aria-selected", String(name === mode));
    $(name + "-tab").tabIndex = name === mode ? 0 : -1;
  }
  $("map-error").hidden = creating || !map.hasTileError();
  $("create-map-error").hidden = !creating || !createMap.hasTileError();
}
function renderCreated() {
  const route = draft(),
    points = route.points;
  $("track-count").textContent = `${points.length} route points`;
  $("waypoint-count").textContent = String(points.length);
  $<HTMLInputElement>("create-name").value = route.name;
  $<HTMLInputElement>("create-color").value = route.color;
  if (points.length < 2) drawingMode = "add";
  const closed = isClosedRoute(route);
  $("create-map-hint").textContent =
    drawingMode === "insert"
      ? "Tap a route line to insert one point. Then Add points resumes automatically."
      : !points.length
        ? "Tap the map to place your starting point."
        : closed
          ? "Loop closed · Drag markers to reshape, or tap to extend"
          : "Add points · Every map tap extends the route, even near an existing line";
  $("draw-add").setAttribute("aria-pressed", String(drawingMode === "add"));
  $("draw-insert").setAttribute(
    "aria-pressed",
    String(drawingMode === "insert"),
  );
  $<HTMLButtonElement>("draw-add").disabled = busy;
  $<HTMLButtonElement>("draw-insert").disabled = busy || points.length < 2;
  $<HTMLButtonElement>("create-close").disabled =
    busy || points.length < 3 || closed;
  $("create-close").textContent = closed ? "Loop closed" : "Close loop";
  $("coordinate-heading").textContent = coordinateSystems[coordinateSystem];
  let total = 0;
  $("waypoint-rows").innerHTML = points.length
    ? points
        .map((point, i) => {
          const leg = i ? analyticsDistance(points[i - 1], point) : 0;
          total += leg;
          return `<tr><th scope="row"><button class="text-button" data-focus-point="${i}" aria-label="Show point ${i + 1} on map">${i + 1}${i === 0 ? " · Start" : i === points.length - 1 ? " · End" : ""}</button></th><td colspan="2">${esc(formatCoordinate(point, coordinateSystem))}</td><td>${km(leg)} km</td><td>${km(total)} km</td><td>${point.ele === undefined ? "—" : metres(point.ele) + " m"}</td><td><button class="icon-button" data-remove-point="${i}" aria-label="Remove point ${i + 1}">${icon("trash", 16)}</button></td></tr>`;
        })
        .join("")
    : '<tr><td colspan="7" class="waypoint-empty">Your points will appear here. Tap the map to begin.</td></tr>';
  $("waypoint-rows")
    .querySelectorAll<HTMLButtonElement>("[data-remove-point]")
    .forEach((button) => {
      button.onclick = () =>
        changeCreated(() =>
          removeWaypoint(draft(), Number(button.dataset.removePoint)),
        );
    });
  $("waypoint-rows")
    .querySelectorAll<HTMLButtonElement>("[data-focus-point]")
    .forEach((button) => {
      button.onclick = () => {
        const p = draft().points[Number(button.dataset.focusPoint)];
        createMap.map.setView(
          [p.lat, p.lon],
          Math.max(createMap.map.getZoom(), 15),
        );
        $("map-panel").scrollIntoView({ behavior: "smooth", block: "start" });
      };
    });
  $<HTMLButtonElement>("create-save").disabled = busy || points.length < 2;
  $<HTMLButtonElement>("create-terrain").disabled =
    busy || points.length < 2 || !!workspace.createdTerrain;
  $<HTMLButtonElement>("create-clear").disabled = busy || !points.length;
  $<HTMLInputElement>("create-name").disabled = busy;
  $<HTMLInputElement>("create-color").disabled = busy;
}
$("edit-tab").onclick = () => setMode("edit");
$("create-tab").onclick = () => setMode("create");
for (const name of ["edit", "create"])
  $(name + "-tab").onkeydown = (e) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const next =
      e.key === "Home"
        ? "create"
        : e.key === "End"
          ? "edit"
          : mode === "edit"
            ? "create"
            : "edit";
    setMode(next);
    $(next + "-tab").focus();
  };
let nameEditStarted = false;
$<HTMLInputElement>("create-name").oninput = (e) => {
  if (busy) return;
  if (!nameEditStarted) {
    createUndo.push(createdSnapshot());
    if (createUndo.length > 30) createUndo.shift();
    createRedo = [];
    nameEditStarted = true;
  }
  const name =
    (e.target as HTMLInputElement).value.trim() || "My walking route";
  workspace.created = { ...draft(), name };
  if (workspace.createdTerrain)
    workspace.createdTerrain = { ...workspace.createdTerrain, name };
  $<HTMLButtonElement>("undo").disabled = false;
  $<HTMLButtonElement>("redo").disabled = true;
  persist();
  renderStats();
};
$<HTMLInputElement>("create-name").onblur = () => {
  nameEditStarted = false;
  $<HTMLInputElement>("create-name").value = draft().name;
};
$<HTMLInputElement>("create-color").onchange = (e) => {
  const color = (e.target as HTMLInputElement).value,
    terrain = workspace.createdTerrain;
  changeCreated(() => ({ ...draft(), color }));
  if (terrain) {
    workspace.createdTerrain = { ...terrain, color };
    persist();
    render();
  }
};
$("draw-add").onclick = () => {
  if (!busy) {
    drawingMode = "add";
    render();
  }
};
$("draw-insert").onclick = () => {
  if (!busy && draft().points.length >= 2) {
    drawingMode = "insert";
    render();
  }
};
$("create-close").onclick = () => {
  if (changeCreated(() => closeRoute(draft()))) {
    drawingMode = "add";
    render();
    notification(
      "Loop closed at your starting point. The return leg is included in distance; fetch terrain for updated ascent.",
    );
  }
};
$("create-save").onclick = () => {
  if (draft().points.length >= 2) void exportTrack(createdTrack());
};
$("create-clear").onclick = () => {
  openDialog(
    `${dialogHeader("Start a fresh route?", "Clear the points in Create. Your Edit tracks will stay in place.")}<p>You can undo this change. Save the current route first if you need a GPX copy.</p><div class="dialog-actions"><button class="button secondary" data-close>Keep route</button><button id="confirm-clear-created" class="button primary">Clear points</button></div>`,
  );
  $("confirm-clear-created").onclick = () => {
    drawingMode = "add";
    changeCreated(newCreatedRoute);
    $<HTMLDialogElement>("dialog").close();
  };
};
$("retry-create-map").onclick = () => {
  $("create-map-error").hidden = true;
  createMap.retryTiles();
};
$("create-terrain").onclick = () => {
  if (busy || draft().points.length < 2) return;
  openDialog(
    `${dialogHeader("Add terrain to your new route")}<p>Route coordinates are sent to Open Topo Data to sample heights about every 90 metres along each straight leg. Ascent is an estimate. This does not make the route follow paths.</p><div class="dialog-actions"><button class="button secondary" data-close>Cancel</button><button id="confirm-create-terrain" class="button primary">Fetch route terrain</button></div>`,
  );
  $("confirm-create-terrain").onclick = async () => {
    busy = true;
    terrainController = new AbortController();
    render();
    $("dialog-content").innerHTML =
      `${dialogHeader("Fetching route terrain")}<p id="create-terrain-progress" role="status">Preparing route…</p><div class="dialog-actions"><button id="cancel-create-terrain" class="button secondary">Cancel</button></div>`;
    const cancel = () => terrainController?.abort();
    $("cancel-create-terrain").onclick = cancel;
    $<HTMLDialogElement>("dialog").oncancel = cancel;
    try {
      const before = createdSnapshot(),
        route = draft();
      const sampled = await enrichTerrain(
        {
          ...route,
          points: route.points.map((p, i) => ({
            ...p,
            gapBefore: i > 0,
            terrain: undefined,
          })),
        },
        (message) => {
          $("create-terrain-progress").textContent = message;
        },
        terrainController.signal,
      );
      const heights = new Map(
        sampled.points.map((p) => [`${p.lat},${p.lon}`, p.ele]),
      );
      createUndo.push(before);
      if (createUndo.length > 30) createUndo.shift();
      createRedo = [];
      workspace.createdTerrain = {
        ...sampled,
        points: sampled.points.map(({ lat, lon, ele }) => ({ lat, lon, ele })),
      };
      workspace.created = {
        ...route,
        points: route.points.map((p) => ({
          ...p,
          ele: heights.get(`${p.lat},${p.lon}`),
        })),
      };
      persist();
      notification("Terrain estimates added to route distance and ascent.");
    } catch (error) {
      report(error);
    } finally {
      busy = false;
      terrainController = null;
      $<HTMLDialogElement>("dialog").oncancel = null;
      $<HTMLDialogElement>("dialog").close();
      render();
    }
  };
};
$("import").onclick = () => importFiles();
$("empty-import").onclick = () => importFiles();
function loadSampleTracks() {
  commit(() => {
    const tracks = demoTracks();
    ensureTrackCapacity(
      tracks.length,
      tracks.reduce((n, t) => n + t.points.length, 0),
    );
    workspace.tracks.push(...tracks);
    workspace.activeId = tracks[0].id;
    workspace.selection = { start: 0, end: tracks[0].points.length - 1 };
    notification(
      "Illustrative sample tracks loaded. Import your own GPX files to plan a real walk.",
    );
  }, true);
}
$("demo").onclick = loadSampleTracks;
$("view-toggle").onclick = () => {
  showAll = !showAll;
  render();
  fitMap();
};
$("fit").onclick = fitMap;
function expandMap() {
  expanded = !expanded;
  document.body.classList.toggle("map-expanded", expanded);
  $("expand").innerHTML = icon(expanded ? "collapse" : "expand", 18);
  $("expand").setAttribute(
    "aria-label",
    expanded ? "Collapse map" : "Expand map",
  );
  $("expand").title = expanded ? "Collapse map" : "Expand map";
  setTimeout(() => {
    visibleMap().map.invalidateSize();
    fitMap();
  }, 50);
}
$("expand").onclick = expandMap;
$("retry-map").onclick = () => {
  $("map-error").hidden = true;
  map.retryTiles();
};
function history(back: boolean) {
  if (busy) return;
  if (mode === "create") {
    const from = back ? createUndo : createRedo,
      to = back ? createRedo : createUndo;
    if (!from.length) return;
    to.push(createdSnapshot());
    restoreCreated(from.pop()!);
    persist();
    render();
    return;
  }
  const from = back ? undo : redo,
    to = back ? redo : undo;
  if (!from.length) return;
  to.push(structuredClone(workspace));
  const created = workspace.created,
    terrain = workspace.createdTerrain;
  workspace = from.pop()!;
  workspace.created = created;
  workspace.createdTerrain = terrain;
  persist();
  render();
  fitMap();
}
$("undo").onclick = () => history(true);
$("redo").onclick = () => history(false);
$("settings").onclick = () => {
  openDialog(
    `${dialogHeader("Settings", "", true)}<label class="field-label" for="coordinate-system">Coordinate system</label><select id="coordinate-system" class="text-input">${Object.entries(
      coordinateSystems,
    )
      .map(
        ([value, label]) =>
          `<option value="${value}" ${value === coordinateSystem ? "selected" : ""}>${label}</option>`,
      )
      .join(
        "",
      )}</select><p class="dialog-note">Used for route points and the map centre in Create and Edit. GPX files always use WGS84 Lat/Long. This choice is remembered on this device.</p><p class="dialog-note">Irish and British National Grid references use approximate datum conversions. ITM uses ETRS89; global formats use WGS84, including USNG. UTM, MGRS and USNG cover 80°S to 84°N. Regional grids show an out-of-area message elsewhere.</p><div class="dialog-actions"><button class="button primary" data-close>Done</button></div>`,
  );
  $("coordinate-system").onchange = async (event) => {
    const value = (event.target as HTMLSelectElement).value;
    if (!isCoordinateSystem(value)) return;
    coordinateSystem = value;
    render();
    try {
      await set(COORDINATE_KEY, value);
    } catch {
      notification(
        "Coordinate format changed for this session, but could not be saved on this device.",
        true,
      );
    }
  };
};
$("help").onclick = () =>
  openDialog(
    `${dialogHeader("A route that’s yours", "A quick guide to BareGPS Route Planner", true)}<h3>Create a route</h3><ol class="help-list"><li><strong>Add points.</strong> Tap the map to place the start and each next point. Add points always extends the route, even beside an existing line.</li><li><strong>Insert a point.</strong> Choose Insert point, then tap the chosen route line. The new point goes between its neighbours and Add points resumes automatically.</li><li><strong>Move or remove points.</strong> Drag any numbered marker to reshape the route. The grid shows walking order, coordinates, leg and total distances, and available heights. Tap a point number to locate it; use its bin button to remove it.</li><li><strong>Close a loop.</strong> Close loop joins the last point precisely to the start, including that return leg in distance. Undo can reopen the loop.</li><li><strong>Check the route.</strong> Lines connect points directly and do not automatically follow paths. Check that your route is walkable.</li><li><strong>Fetch terrain.</strong> With at least two points, fetch heights sampled along every leg for estimated ascent and descent. Coordinates are sent to Open Topo Data. Moving, adding or removing points clears previous terrain estimates; fetch again after changes.</li><li><strong>Save.</strong> Choose a name and colour, then Save route exports GPX. Undo/redo are below the device status in the title. Edit and Create preserve separate work and map positions. Irish demonstration tracks are optional and available from the welcome screen’s sample button.</li></ol><p class="dialog-note">The current-position button at the upper right of either map centres it on your device location. It requests access only when tapped and never adds a route point. Use the cog beneath ? to choose the coordinate system for route points and the map centre. This display setting is remembered on this device; exported GPX remains WGS84 Lat/Long.</p><h3>Edit GPX tracks</h3><ol class="help-list"><li><strong>Open your files.</strong> Choose one or more GPX tracks or routes from Files. Multiple tracks in one file are supported.</li><li><strong>Choose a section.</strong> Drag A and B on the map or use the sliders. Distance and ascent update as you go.</li><li><strong>Shape your route.</strong> Save the section, split it into two tracks, reverse direction, or add it to a joined route. Add sections in walking order.</li><li><strong>Check connections.</strong> Dashed lines connect separated sections. Their distance and ascent count. Fetch terrain to include hills between endpoints.</li><li><strong>Save to Files.</strong> Save the current section or your complete joined route as GPX. Your originals stay untouched.</li></ol><p class="dialog-note">Undo / redo: ⌘ or Ctrl + Z / Shift + Z. Escape collapses the map. Edits are saved on this device. Ascent sums elevation gains; missing heights are marked as partial. GPX connection markers and track colours round-trip in BareGPS.</p><button class="button primary full" data-close>Let’s go</button>`,
  );
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && expanded && !$<HTMLDialogElement>("dialog").open)
    expandMap();
  if (
    (e.metaKey || e.ctrlKey) &&
    e.key.toLowerCase() === "z" &&
    !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)
  ) {
    e.preventDefault();
    history(!e.shiftKey);
  }
});
window.addEventListener("unhandledrejection", (e) => {
  report(e.reason);
  e.preventDefault();
});
window.addEventListener("error", (e) => {
  if (e.error) report(e.error);
});
let pendingTimer: ReturnType<typeof setTimeout>;
async function pendingFiles() {
  clearTimeout(pendingTimer);
  if (busy) {
    pendingTimer = setTimeout(pendingFiles, 500);
    return;
  }
  try {
    const { files, errors } = await NativeFiles.pending();
    if (files.length)
      await importFiles(
        files.map((f) => ({ name: f.name, text: decode(f.data) })),
      );
    if (errors?.length) notification(errors.join(" "), true);
  } catch (e) {
    report(e);
  }
}
async function init() {
  try {
    const savedCoordinates = await get(COORDINATE_KEY);
    if (isCoordinateSystem(savedCoordinates))
      coordinateSystem = savedCoordinates;
  } catch {
    /* Default coordinates remain available without storage. */
  }

  try {
    const saved = await get(STORAGE_KEY);
    if (saved) {
      if (validateWorkspace(saved)) {
        workspace = saved;
        const t = active();
        if (t)
          workspace.selection = {
            start: Math.max(
              0,
              Math.min(t.points.length - 2, workspace.selection.start),
            ),
            end: Math.max(
              1,
              Math.min(t.points.length - 1, workspace.selection.end),
            ),
          };
        if (workspace.selection.end <= workspace.selection.start)
          workspace.selection.end = workspace.selection.start + 1;
      } else
        notification(
          "The saved workspace could not be restored. Import your GPX files again. The saved data has not been overwritten.",
          true,
        );
    }
  } catch {
    notification(
      "Workspace storage is unavailable. You can still edit and export GPX files.",
      true,
    );
  }
  render();
  fitMap();
  if (Capacitor.isNativePlatform()) {
    await NativeFiles.addListener("filesOpened", pendingFiles);
    await pendingFiles();
  }
}
void init();
