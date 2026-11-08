import "leaflet/dist/leaflet.css";
import "./style.css";
import { aboutGuide } from "./about";
import { get, set } from "idb-keyval";
import { Capacitor } from "@capacitor/core";
import {
  analytics,
  COLORS,
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
  shareRoutecard,
  sharePDF,
  isCancelled,
  NativeFiles,
  decode,
  type ImportFile,
} from "./files";
import { TrackMap, CreateMap } from "./map";
import { icon } from "./icons";
import { routecardText, routecardRows } from "./routecard";
import { demoTracks, isDemoTrack } from "./demo";
import "vanilla-colorful/hex-color-picker.js";
import type { HexColorPicker } from "vanilla-colorful/hex-color-picker.js";
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
let allowPointNaming = false;
const POINT_NAMING_KEY = "baregps-allow-point-naming-v1";

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
let editWelcome = true;
let examplesVisible = false;
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
let cardExpanded = false;
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
<header class="app-header"><a class="brand" href="#" aria-label="BareGPS Route Planner home"><img src="${import.meta.env.BASE_URL}logo.svg" alt="" width="40" height="40"><span class="brand-copy"><strong class="brand-title">BareGPS Route Planner</strong><span class="brand-subtitle">GPX Creator and Editor</span></span></a><div class="header-right"><div class="device-status"><span id="save-state" class="save-state" role="status" title="Your workspace is kept on this device. Use Save section or Save route to export a GPX file."><span class="save-full">On your device</span><span class="save-short" aria-hidden="true">On device</span></span><div class="history" role="group" aria-label="Edit history"><button id="undo" class="icon-button" aria-label="Undo" title="Undo (⌘/Ctrl Z)">${icon("undo", 18)}</button><button id="redo" class="icon-button" aria-label="Redo" title="Redo (⌘/Ctrl Shift Z)">${icon("redo", 18)}</button></div></div><div class="header-utilities"><button id="help" class="icon-button" aria-label="About and keyboard shortcuts">${icon("help")}</button><button id="settings" class="icon-button" aria-label="Settings" title="Settings">${icon("settings", 19)}</button></div></div></header>
<main>
  <span id="track-count" class="sr-only">Your workspace</span>
  <section id="map-panel" class="map-panel" aria-label="Track map">
    <div class="mode-tabs" role="tablist" aria-label="Route workspace"><button id="create-tab" role="tab" aria-selected="true" aria-controls="create-map-view">Create</button><button id="edit-tab" role="tab" aria-selected="false" aria-controls="edit-map-view" tabindex="-1">Edit</button><span id="mode-caption">Work with your GPX tracks</span></div>
    <div class="map-toolbar"><span class="map-label">${icon("mountain", 18)}<strong>OpenTopoMap</strong><span class="terrain-label">TERRAIN</span></span><div class="map-actions"><button id="view-toggle" class="small-button">${icon("eye", 16)}<span>All tracks</span></button><span class="toolbar-divider"></span><button id="fit" class="icon-button" aria-label="Fit tracks to map" title="Fit tracks">${icon("fit", 18)}</button><button id="expand" class="icon-button" aria-label="Expand map" title="Expand map">${icon("expand", 18)}</button></div></div>
    <div id="edit-map-view" role="tabpanel" aria-labelledby="edit-tab"><div id="map"></div><button id="edit-locate" class="icon-button map-locate" aria-label="Go to current position" title="Go to current position">${icon("locate", 21)}</button><span id="edit-coordinates" class="map-coordinates" aria-label="Map centre coordinates"></span></div>
    <div id="create-map-view" role="tabpanel" aria-labelledby="create-tab" hidden><div id="create-map" aria-label="Create a walking route"></div><button id="create-locate" class="icon-button map-locate" aria-label="Go to current position" title="Go to current position">${icon("locate", 21)}</button><span id="create-coordinates" class="map-coordinates" aria-label="Map centre coordinates"></span><p class="create-map-hint" id="create-map-hint">Tap the map to place your starting point.</p></div>
    <div id="create-tools" class="create-tools" role="group" aria-label="Route drawing controls" hidden><div class="drawing-modes" role="group" aria-label="Drawing mode"><button id="draw-add" aria-pressed="true">Add points</button><button id="draw-insert" aria-pressed="false">Insert point</button></div><button id="create-close" class="small-button">Close loop</button></div>
    <div id="map-empty" class="map-empty"><button id="empty-import" class="button primary">${icon("plus", 18)}Open GPX files</button><button id="demo" class="text-button">Explore with sample tracks ${icon("chevron", 14)}</button></div>
    <div id="create-map-error" class="map-error" hidden>Map tiles couldn’t load. You can still shape and save your route.<button id="retry-create-map" class="text-button">Retry</button></div>
    <div id="map-error" class="map-error" hidden>Map tiles couldn’t load. Your tracks and editing are still available.<button id="retry-map" class="text-button">Retry</button></div>
    <div class="map-legend" id="map-legend" hidden><span><i class="legend-solid"></i>Recorded track</span><span><i class="legend-dashed"></i>Walking connection</span></div>
  </section>
  <section id="analytics" class="analytics" aria-label="Live track analytics"><div class="metric"><span>${icon("route", 17)} Distance(km)</span><strong id="distance">0.00</strong></div><div class="metric"><span>${icon("up", 17)} Ascent(m)</span><strong id="ascent">0</strong></div><div class="metric"><span>${icon("down", 17)} Descent(m)</span><strong id="descent">0</strong></div><div class="metric selection-metric"><span>${icon("pin", 17)} <span id="selection-caption">SELECTED SECTION</span></span><strong id="point-count">No track selected</strong><span id="analytics-source" class="metric-note">Open a file to begin</span></div></section>
  <section class="profile-card" aria-label="Elevation profile"><div class="profile-heading"><span>ELEVATION PROFILE</span><span id="profile-range">Select a track to explore its elevation</span></div><div id="profile"></div><div id="elevation-note" class="elevation-note" hidden></div></section>
  <div id="editor" class="editor-grid">
    <section class="card tracks-card"><div class="card-heading"><h2>Your tracks <span id="source-count" class="badge">0</span></h2><button id="import" class="button secondary compact">${icon("plus", 16)}Open files</button></div><div id="track-list" class="track-list"></div><div class="card-footnote"><span>${icon("file", 14)} GPX files · originals stay untouched</span></div></section>
    <section class="card section-card"><div class="card-heading"><h2>Edit a section</h2><span class="badge soft">A → B</span></div><div id="section-controls"></div></section>
  </div>
  <section id="route-card" class="route-card"></section>
  <section id="create-card" class="card create-card" aria-label="Route Card" hidden>
    <div class="card-heading"><h2>Route Card <span id="waypoint-count" class="badge">0</span></h2><button id="expand-card" class="icon-button" aria-label="Expand Route Card" aria-expanded="false" title="Expand Route Card">${icon("expand", 18)}</button></div>
    <p id="card-source-note" class="card-source-note" hidden></p>
    <div class="create-settings"><label><span id="card-name-label">Route name</span><input id="create-name" class="text-input" maxlength="120" value="My walking route"></label></div>
    <p class="card-scroll-hint card-extra">Swipe across for distance and ascent →</p>
    <div class="waypoint-scroll" role="region" aria-label="Route points" tabindex="0"><table class="waypoint-table"><caption class="sr-only">Route points in walking order</caption><colgroup><col class="point-col"><col class="name-col"><col class="grid-col"><col class="height-col"><col class="card-extra distance-col"><col class="compact-delete"><col class="card-extra cumulative-distance-col"><col class="card-extra ascent-col"><col class="card-extra cumulative-ascent-col"></colgroup><thead><tr><th scope="col">Point</th><th class="point-name-cell" scope="col">Name</th><th id="coordinate-heading" scope="col">Grid ref.</th><th scope="col">Height<span class="heading-unit">(m)</span></th><th class="card-extra distance-cell" scope="col">Distance<span class="heading-unit">(km)</span></th><th class="compact-delete" scope="col"><span class="sr-only">Delete point</span></th><th class="card-extra" scope="col">Cumul<br>Distance<span class="heading-unit">(km)</span></th><th class="card-extra" scope="col">Ascent<span class="heading-unit">(m)</span></th><th class="card-extra" scope="col">Cumul<br>Ascent<span class="heading-unit">(m)</span></th></tr></thead><tbody id="waypoint-rows"></tbody></table></div>
    <div class="card-share-actions card-extra"><button id="create-share" class="button secondary">${icon("export", 17)}Share Text</button><button id="create-pdf" class="button secondary">${icon("file", 17)}Share PDF</button></div>
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
  view.map.on("moveend resize", () => updateMapCoordinates(name, view));
}
function updateMapCoordinates(name: string, view: TrackMap) {
  const centre = view.map.getCenter().wrap();
  const attribution = view.map
    .getContainer()
    .querySelector<HTMLElement>(".leaflet-control-attribution");
  if (attribution) {
    $(name + "-coordinates").style.bottom = `${attribution.offsetHeight + 2}px`;
    view.map
      .getContainer()
      .style.setProperty(
        "--map-attribution-height",
        `${attribution.offsetHeight}px`,
      );
  }
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
    (t) => t.id === workspace.activeId && (examplesVisible || !isDemoTrack(t)),
  ) ?? null;
const displayTracks = () =>
  workspace.tracks.filter((t) => examplesVisible || !isDemoTrack(t));
const displayMapTracks = () => [
  ...displayTracks(),
  ...(workspace.route ? [workspace.route] : []),
];
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
  editWelcome = false;
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
  if (editWelcome) {
    map.home();
    return;
  }
  const t = active();
  map.fit(
    showAll ? displayMapTracks() : t ? [t] : [],
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
  if (mode === "edit") renderPointCard();
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
  const tracks = editWelcome ? [] : displayMapTracks();
  map.render(
    tracks,
    editWelcome ? null : active(),
    workspace.selection,
    showAll,
  );
  $("map-empty").hidden = tracks.length > 0;
  $("map-legend").hidden = !tracks.length;
}
function renderStats(preview?: Track) {
  const t =
      mode === "create"
        ? (preview ?? createdTrack())
        : editWelcome
          ? null
          : active(),
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
    `${hasElevation ? metres(a.ascent) : "0"}${hasElevation && (mode === "create" || a.missingEdges || a.estimatedGap) ? "<sup>est.</sup>" : ""}`;
  $("descent").innerHTML = `${hasElevation ? metres(a.descent) : "0"}`;
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
      ? "Ascent and descent are unavailable until terrain is fetched."
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
  profile.innerHTML = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Elevation profile, ${metres(min)} to ${metres(a.max!)} metres"><defs><linearGradient id="profile-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${t!.color}" stop-opacity=".18"/><stop offset="100%" stop-color="${t!.color}" stop-opacity=".015"/></linearGradient></defs><path d="M0 23H1000M0 47H1000" stroke="var(--divider)" stroke-dasharray="3 5"/>${area ? `<path d="${area}" fill="url(#profile-fill)"/>` : ""}<path d="${paths}" fill="none" stroke="${t!.color}" stroke-width="2" vector-effect="non-scaling-stroke"/><path d="${gapPaths}" fill="none" stroke="${t!.color}" stroke-width="2" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"/></svg><div class="profile-axis"><span>0 km</span><span>${km(a.length)} km</span></div>`;
}
import { distance as analyticsDistance } from "./model";
function renderTracks() {
  const tracks = displayTracks();
  $("source-count").textContent = String(tracks.length);
  $("track-count").textContent = displayMapTracks().length
    ? `${tracks.length} ${tracks.length === 1 ? "track" : "tracks"} in workspace`
    : "Your workspace";
  const list = $("track-list");
  list.innerHTML = tracks.length
    ? tracks
        .map((t) => {
          const a = analytics(t.points);
          return `<div class="track-row ${!editWelcome && t.id === workspace.activeId ? "active" : ""}"><button class="track-select" data-id="${t.id}" aria-pressed="${!editWelcome && t.id === workspace.activeId}"><span class="track-symbol" style="--track-color:${t.color}">${icon("route", 20)}</span><span class="track-text"><strong>${esc(t.name)}</strong><small>${km(a.length)} km <span>·</span> ${t.points.some((p) => p.ele !== undefined) ? `${metres(a.ascent)} m ↗` : "No elevation"} <span>·</span> ${t.points.length.toLocaleString()} pts</small></span>${!editWelcome && t.id === workspace.activeId ? '<span class="active-dot"></span>' : icon("chevron", 15)}</button><button class="icon-button delete-track" data-id="${t.id}" aria-label="Remove ${esc(t.name)}" title="Remove track">${icon("trash", 16)}</button></div>`;
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
  const t = editWelcome ? null : active(),
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
  </div><div class="line-color"><span>Line colour</span><button id="track-color" class="color-trigger" style="--line-colour:${t.color}" aria-label="Choose track line colour" title="Choose track line colour"></button></div></div>
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
  $("track-color").onclick = () =>
    openColourPicker(t.color, (color) => {
      if (color !== t.color) commit(() => replace({ ...t, color }));
    });
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
  else renderPointCard();
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
      ![
        "expand",
        "expand-card",
        "help",
        "settings",
        "retry-map",
        "retry-create-map",
        "fit",
      ].includes(b.id)
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
      editWelcome = false;
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
function openDialog(content: string, variant?: "about") {
  $("dialog").classList.toggle("about-dialog", variant === "about");
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
function colourForm(initial: string, embedded = false) {
  return `<form id="colour-form"><hex-color-picker id="colour-spectrum" color="${initial}"></hex-color-picker><div class="colour-presets" role="group" aria-label="Preset colours">${COLORS.map((color) => `<button type="button" class="colour-preset" data-colour="${color}" style="--line-colour:${color}" aria-label="Use ${color}" aria-pressed="${color === initial}"></button>`).join("")}</div><label class="field-label" for="colour-hex">Hex colour</label><div class="colour-value"><span id="colour-preview" style="--line-colour:${initial}" aria-hidden="true"></span><input id="colour-hex" class="text-input" value="${initial.toUpperCase()}" pattern="#[0-9A-Fa-f]{6}" maxlength="7" spellcheck="false" autocapitalize="characters" required title="Use # followed by six hexadecimal characters"></div><div class="dialog-actions">${embedded ? "" : `<button type="button" class="button secondary" data-close>Cancel</button>`}<button class="button primary">Apply colour</button></div></form>`;
}
function openColourPicker(initial: string, apply: (color: string) => void) {
  openDialog(
    `${dialogHeader("Line colour", "Choose a colour for your route", true)}${colourForm(initial)}`,
  );
  bindColourPicker(initial, apply, true);
}
function bindColourPicker(
  initial: string,
  apply: (color: string) => void,
  closeAfterApply = false,
) {
  const spectrum = $<HexColorPicker>("colour-spectrum");
  const field = $<HTMLInputElement>("colour-hex");
  function preview(color: string, updateField: boolean) {
    if (!/^#[0-9a-f]{6}$/i.test(color)) return;
    spectrum.color = color;
    if (updateField) field.value = color.toUpperCase();
    $("colour-preview").style.setProperty("--line-colour", color);
    document
      .querySelectorAll<HTMLButtonElement>("[data-colour]")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.colour === color.toLowerCase()),
        ),
      );
  }
  spectrum.addEventListener("color-changed", (event) =>
    preview(event.detail.value, true),
  );
  field.oninput = () => preview(field.value, false);
  document
    .querySelectorAll<HTMLButtonElement>("[data-colour]")
    .forEach(
      (button) =>
        (button.onclick = () => preview(button.dataset.colour!, true)),
    );
  $("colour-form").onsubmit = (event) => {
    event.preventDefault();
    if (!field.reportValidity()) return;
    apply(field.value.toLowerCase());
    if (closeAfterApply) $<HTMLDialogElement>("dialog").close();
    else {
      $("colour-status").textContent = "Created route colour applied.";
    }
  };
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
  if (cardExpanded) toggleCard();
  const firstCreate = next === "create" && !createMapOpened;
  if (next === "create") createMapOpened = true;
  mode = next;
  if (next === "edit") {
    editWelcome = true;
    examplesVisible = false;
    showAll = true;
  }
  drawingMode = "add";
  render();
  if (next === "edit") {
    map.home();
    updateMapCoordinates("edit", map);
  }
  requestAnimationFrame(() => {
    if (mode !== next) return;
    visibleMap().map.invalidateSize({ pan: false });
    if (next === "edit" && editWelcome) {
      map.home();
      updateMapCoordinates("edit", map);
    }
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
  document.body.classList.toggle("point-naming", allowPointNaming);
  $("edit-map-view").hidden = creating;
  $("create-map-view").hidden = !creating;
  $("editor").hidden = creating;
  $("route-card").hidden = creating || editWelcome || !workspace.route;
  $("create-card").hidden = false;
  $("create-tools").hidden = !creating;
  $("view-toggle").hidden = creating || editWelcome;
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
const emptyCardRoute: Track = {
  id: "empty-card",
  name: "",
  color: "#16724d",
  points: [],
  source: "",
  kind: "track",
};
function routeCardContext() {
  if (mode === "create")
    return {
      route: draft(),
      terrain: workspace.createdTerrain,
      source: draft(),
      offset: 0,
      description: "",
    };
  const source = workspace.route ?? (editWelcome ? null : active());
  if (!source) return null;
  if (source === workspace.route)
    return {
      route: source,
      terrain: undefined,
      source,
      offset: 0,
      description: `Whole joined route · ${source.points.length} points`,
    };
  const { start, end } = workspace.selection;
  const whole = start === 0 && end === source.points.length - 1;
  return {
    route: {
      ...source,
      name: whole
        ? source.name
        : `${source.name} · points ${start + 1}–${end + 1}`,
      points: selectedPoints(source, workspace.selection),
    },
    terrain: undefined,
    source,
    offset: start,
    description: whole
      ? `Whole track · ${source.points.length} points`
      : `Selected section · points ${start + 1}–${end + 1} of ${source.points.length}`,
  };
}
function fitCardCoordinates() {
  const values = Array.from(
    $("waypoint-rows").querySelectorAll<HTMLElement>(".coordinate-value"),
  );
  for (const value of values) value.style.fontSize = "";
  // Re-measure rendered glyphs: font hinting can make proportional estimates a pixel wider.
  for (let pass = 0; pass < 4; pass++) {
    const sizes = values.map((value) => {
      const cell = value.parentElement!;
      const style = getComputedStyle(cell);
      const available =
        cell.clientWidth -
        parseFloat(style.paddingLeft) -
        parseFloat(style.paddingRight);
      const width = value.getBoundingClientRect().width;
      const currentSize = parseFloat(getComputedStyle(value).fontSize);
      return available > 0 && width > available
        ? Math.max(
            1,
            Math.floor(
              ((currentSize * Math.max(1, available - 1)) / width) * 100,
            ) / 100,
          )
        : null;
    });
    if (sizes.every((size) => size === null)) break;
    values.forEach((value, i) => {
      if (sizes[i] !== null) value.style.fontSize = `${sizes[i]}px`;
    });
  }
}
function updateCardScrollLimit() {
  fitCardCoordinates();
  const empty =
    $("waypoint-rows").querySelector<HTMLTableCellElement>(".waypoint-empty");
  if (empty)
    empty.colSpan = cardExpanded
      ? allowPointNaming
        ? 8
        : 7
      : mode === "create"
        ? 5
        : 4;
  if (cardExpanded) return;
  const table =
    $("create-card").querySelector<HTMLTableElement>(".waypoint-table")!;
  const rows = Array.from($<HTMLTableSectionElement>("waypoint-rows").rows)
    .filter((row) => !row.classList.contains("card-spacer"))
    .slice(0, 6);
  const last = rows.at(-1);
  if (!last || !table.getBoundingClientRect().height) return;
  const virtualHeight = Number(table.dataset.virtualRowHeight);
  const height = virtualHeight
    ? Math.floor(
        (table.tHead?.getBoundingClientRect().height ?? 0) +
          virtualHeight * Math.min(6, rows.length),
      ) + 1
    : Math.floor(
        last.getBoundingClientRect().bottom - table.getBoundingClientRect().top,
      ) + 1;
  const value = `${height}px`;
  if (
    table.parentElement!.style.getPropertyValue("--compact-card-height") !==
    value
  )
    table.parentElement!.style.setProperty("--compact-card-height", value);
}
const cardTableObserver = new ResizeObserver(updateCardScrollLimit);
cardTableObserver.observe($("create-card").querySelector(".waypoint-table")!);
function renderCreated() {
  const route = draft(),
    points = route.points;
  $("track-count").textContent = `${points.length} route points`;
  $("waypoint-count").textContent = String(points.length);
  $<HTMLInputElement>("create-name").value = route.name;
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
  renderPointCard();
}
let cardSourceKey = "";
let cardScrollFrame = 0;
function renderPointCard() {
  if (cardScrollFrame) cancelAnimationFrame(cardScrollFrame);
  cardScrollFrame = 0;
  const context = routeCardContext();
  const route = context?.route ?? emptyCardRoute;
  const points = route.points;
  const offset = context?.offset ?? 0;
  $("waypoint-count").textContent = String(points.length);
  const nameField = $<HTMLInputElement>("create-name");
  nameField.value = route.name;
  nameField.readOnly = mode === "edit";
  nameField.closest<HTMLElement>(".create-settings")!.hidden =
    mode === "edit" && !context;
  $("card-name-label").textContent =
    mode === "create"
      ? "Route name"
      : context?.source === workspace.route
        ? "Route name"
        : "Track / section";
  $("card-source-note").hidden = mode === "create" || !context;
  $("card-source-note").textContent = context?.description ?? "";
  $("create-save").setAttribute(
    "aria-label",
    mode === "create" ? "Save route" : "Save Route Card as GPX",
  );
  $("create-save").innerHTML =
    `${icon("export", 17)}${mode === "create" || context?.source === workspace.route ? "Save route" : "Save section"}`;
  $("coordinate-heading").textContent = {
    latlon: "Lat/Lon",
    irish: "Irish Grid",
    british: "British Grid",
    itm: "ITM",
    mgrs: "MGRS",
    utm: "UTM",
    usng: "USNG",
  }[coordinateSystem];
  $("coordinate-heading").title = coordinateSystems[coordinateSystem];
  $("create-card").classList.toggle(
    "latlon-coordinates",
    coordinateSystem === "latlon",
  );
  const rows = routecardRows(route, context?.terrain);
  const table =
    $("create-card").querySelector<HTMLTableElement>(".waypoint-table")!;
  const scroller = table.parentElement!;
  const key = `${mode}:${context?.source.id}:${offset}:${points.length}:${cardExpanded}`;
  if (cardSourceKey !== key) {
    scroller.scrollTop = 0;
    cardSourceKey = key;
  }
  const virtual = mode === "edit" && points.length > 400;
  table.classList.toggle("virtual-card-table", virtual);
  table.setAttribute("aria-rowcount", String(points.length + 1));
  table.style.removeProperty("--virtual-row-height");
  delete table.dataset.virtualRowHeight;
  let rowHeight = 36;
  let lastFirst = -1,
    lastEnd = -1;
  const colspan = cardExpanded
    ? allowPointNaming
      ? 8
      : 7
    : mode === "create"
      ? 5
      : 4;
  const spacer = (count: number) =>
    `<tr class="card-spacer" aria-hidden="true" style="height:${count * rowHeight}px"><td colspan="${colspan}" style="height:${count * rowHeight}px"></td></tr>`;
  function drawRows() {
    const first = virtual
      ? Math.max(
          0,
          Math.floor(
            Math.max(0, scroller.scrollTop - (table.tHead?.offsetHeight ?? 0)) /
              rowHeight,
          ) - 10,
        )
      : 0;
    const end = virtual ? Math.min(points.length, first + 100) : points.length;
    if (first === lastFirst && end === lastEnd) return;
    lastFirst = first;
    lastEnd = end;
    const topSpacer = virtual && first > 0 ? spacer(first) : "";
    const bottomSpacer =
      virtual && end < points.length ? spacer(points.length - end) : "";
    $("waypoint-rows").innerHTML = points.length
      ? topSpacer +
        points
          .slice(first, end)
          .map((point, localIndex) => {
            const i = first + localIndex;
            const row = rows[i];
            const coordinate = formatCoordinate(point, coordinateSystem);
            const ascent = (value: number | undefined) =>
              value === undefined
                ? "—"
                : `${metres(value)}<span class="card-cell-unit"> m</span>`;
            return `<tr data-card-row="${i}" aria-rowindex="${i + 2}"><th scope="row"><button class="text-button" data-focus-point="${i}" aria-label="Show point ${offset + i + 1} on map">${offset + i + 1}</button></th><td class="point-name-cell"><input class="point-name" data-point-name="${i}" aria-label="Name for point ${offset + i + 1} (optional)" maxlength="10" placeholder="[Name]" value="${esc(point.name || "")}" ${busy ? "disabled" : ""}></td><td class="grid-reference" title="${esc(coordinate)}"><span class="coordinate-value">${esc(coordinate)}</span></td><td>${ascent(point.ele)}</td><td class="card-extra distance-cell numeric-cell">${km(row.distance)}</td><td class="compact-delete"><button class="icon-button" data-remove-point="${i}" aria-label="Remove point ${i + 1}" ${busy ? "disabled" : ""}>${icon("trash", 15)}</button></td><td class="card-extra">${km(row.total)}</td><td class="card-extra">${ascent(row.ascent)}</td><td class="card-extra">${ascent(row.totalAscent)}</td></tr>`;
          })
          .join("") +
        bottomSpacer
      : `<tr><td colspan="${mode === "create" ? 5 : 4}" class="waypoint-empty">${mode === "create" ? "Your points will appear here. Tap the map to begin." : "Choose a track or open a GPX file to view its Route Card."}</td></tr>`;
    $("waypoint-rows")
      .querySelectorAll<HTMLButtonElement>("[data-remove-point]")
      .forEach((button) => {
        button.onclick = () =>
          mode === "create" &&
          changeCreated(() =>
            removeWaypoint(draft(), Number(button.dataset.removePoint)),
          );
      });
    $("waypoint-rows")
      .querySelectorAll<HTMLInputElement>("[data-point-name]")
      .forEach((input) => {
        let started = false;
        input.onfocus = () => {
          started = false;
        };
        input.oninput = () => {
          if (busy) return;
          if (!started) {
            if (mode === "create") {
              createUndo.push(createdSnapshot());
              if (createUndo.length > 30) createUndo.shift();
              createRedo = [];
            } else checkpoint();
            started = true;
          }
          const point =
            context!.source.points[offset + Number(input.dataset.pointName)];
          point.name = input.value.slice(0, 10) || undefined;
          points[Number(input.dataset.pointName)].name = point.name;
          if (mode === "create" && workspace.createdTerrain) {
            for (const p of workspace.createdTerrain.points) {
              if (p.lat === point.lat && p.lon === point.lon)
                p.name = point.name;
            }
          }
          persist();
          $<HTMLButtonElement>("undo").disabled = false;
          $<HTMLButtonElement>("redo").disabled = true;
        };
        input.onkeydown = (event) => {
          if (event.key === "Enter") input.blur();
        };
      });
    $("waypoint-rows")
      .querySelectorAll<HTMLButtonElement>("[data-focus-point]")
      .forEach((button) => {
        button.onclick = () => {
          if (busy) return;
          const p = points[Number(button.dataset.focusPoint)];
          if (
            mode === "edit" &&
            context &&
            (editWelcome || active()?.id !== context.source.id)
          ) {
            editWelcome = false;
            workspace.activeId = context.source.id;
            workspace.selection = {
              start: 0,
              end: context.source.points.length - 1,
            };
            persist();
            render();
          }
          if (cardExpanded) toggleCard();
          visibleMap().map.setView(
            [p.lat, p.lon],
            Math.max(visibleMap().map.getZoom(), 15),
          );
          $("map-panel").scrollIntoView({ behavior: "smooth", block: "start" });
        };
      });

    fitCardCoordinates();
    if (virtual) {
      const realRows = Array.from(
        $("waypoint-rows").querySelectorAll<HTMLTableRowElement>(
          "tr[data-card-row]",
        ),
      );
      const measured = Math.max(
        1,
        ...realRows.map((row) => row.getBoundingClientRect().height),
      );
      rowHeight = measured;
      table.style.setProperty("--virtual-row-height", `${rowHeight}px`);
      table.dataset.virtualRowHeight = String(rowHeight);
      const spacers = Array.from(
        $("waypoint-rows").querySelectorAll<HTMLTableRowElement>(
          ".card-spacer",
        ),
      );
      let spacerIndex = 0;
      for (const count of [first, points.length - end]) {
        if (count <= 0) continue;
        const row = spacers[spacerIndex++];
        row.style.height = `${count * rowHeight}px`;
        row.cells[0].style.height = row.style.height;
      }
    }
    requestAnimationFrame(updateCardScrollLimit);
  }
  drawRows();
  scroller.onscroll = virtual
    ? () => {
        if (cardScrollFrame) return;
        cardScrollFrame = requestAnimationFrame(() => {
          cardScrollFrame = 0;
          drawRows();
        });
      }
    : null;
  $<HTMLButtonElement>("create-save").disabled = busy || points.length < 2;
  $<HTMLButtonElement>("create-share").disabled = busy || points.length < 2;
  $<HTMLButtonElement>("create-pdf").disabled = busy || points.length < 2;
  $<HTMLButtonElement>("create-terrain").disabled =
    busy || points.length < 2 || !!workspace.createdTerrain;
  $<HTMLButtonElement>("create-clear").disabled = busy || !points.length;
  $<HTMLInputElement>("create-name").disabled = busy;
  requestAnimationFrame(updateCardScrollLimit);
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
  if (busy || mode !== "create") return;
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
  $<HTMLInputElement>("create-name").value =
    routeCardContext()?.route.name ?? "";
};
function applyCreatedColour(color: string) {
  if (busy || color === draft().color) return;
  const terrain = workspace.createdTerrain;
  changeCreated(() => ({ ...draft(), color }));
  if (terrain) {
    workspace.createdTerrain = { ...terrain, color };
    persist();
    render();
  }
}
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
  const context = routeCardContext();
  if (context && context.route.points.length >= 2)
    void exportTrack(context.terrain ?? context.route);
};
$("create-clear").onclick = () => {
  if (busy) return;
  if (mode === "edit") {
    if (!routeCardContext()) return;
    openDialog(
      `${dialogHeader("Clear the Edit route?", "Your imported tracks and Create route stay in place.")}<p>This clears the joined route and current Edit selection. You can undo this change.</p><div class="dialog-actions"><button class="button secondary" data-close>Keep route</button><button id="confirm-clear-edit" class="button primary">Clear route</button></div>`,
    );
    $("confirm-clear-edit").onclick = () => {
      commit(() => {
        workspace.route = null;
        workspace.activeId = null;
        workspace.selection = { start: 0, end: 0 };
        editWelcome = true;
      }, true);
      $<HTMLDialogElement>("dialog").close();
    };
    return;
  }
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
$("create-pdf").onclick = async () => {
  const context = routeCardContext();
  if (busy || !context || context.route.points.length < 2) return;
  const route = structuredClone(context.route);
  const terrain = context.terrain
    ? structuredClone(context.terrain)
    : undefined;
  const system = coordinateSystem;
  try {
    const { routecardPDF } = await import("./routecard-pdf");
    await sharePDF(
      route.name,
      routecardPDF(route, system, terrain, context.offset),
    );
  } catch (error) {
    if (!isCancelled(error)) report(error);
  }
};
function toggleCard() {
  if (!cardExpanded && expanded) expandMap();
  cardExpanded = !cardExpanded;
  document.body.classList.toggle("card-expanded", cardExpanded);
  $("expand-card").innerHTML = icon(cardExpanded ? "collapse" : "expand", 18);
  $("expand-card").setAttribute("aria-expanded", String(cardExpanded));
  $("expand-card").setAttribute(
    "aria-label",
    cardExpanded ? "Collapse Route Card" : "Expand Route Card",
  );
  $("expand-card").title = cardExpanded
    ? "Collapse Route Card"
    : "Expand Route Card";
  if (mode === "edit") renderPointCard();
  requestAnimationFrame(updateCardScrollLimit);
  if (
    cardExpanded &&
    mode === "create" &&
    !busy &&
    draft().points.length >= 2 &&
    !workspace.createdTerrain
  )
    $("create-terrain").click();
}
$("expand-card").onclick = toggleCard;
$("create-share").onclick = async () => {
  const context = routeCardContext();
  if (busy || !context || context.route.points.length < 2) return;
  const title = `${context.route.name} — Routecard`;
  const text = routecardText(
    context.route,
    coordinateSystem,
    context.terrain,
    context.offset,
  );
  try {
    if (await shareRoutecard(title, text)) return;
  } catch (error) {
    if (isCancelled(error)) return;
  }
  openDialog(
    `${dialogHeader("Share Routecard")}<p>Copy this routecard into a message.</p><textarea id="routecard-text" class="text-input routecard-text" aria-label="Routecard text" readonly>${esc(text)}</textarea><div class="dialog-actions"><button class="button secondary" data-close>Done</button><button id="copy-routecard" class="button primary">Copy routecard</button></div><p id="routecard-copy-status" role="status"></p>`,
  );
  $("copy-routecard").onclick = async () => {
    try {
      await navigator.clipboard.writeText(text);
      $("routecard-copy-status").textContent =
        "Routecard copied. Paste it into your message.";
    } catch {
      const field = $<HTMLTextAreaElement>("routecard-text");
      field.focus();
      field.select();
      $("routecard-copy-status").textContent =
        "Text selected. Use your device’s Copy command, then paste into your message.";
    }
  };
};
$("create-terrain").onclick = () => {
  if (mode !== "create" || busy || draft().points.length < 2) return;
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
        points: sampled.points.map(({ lat, lon, ele, name }) => ({
          lat,
          lon,
          ele,
          name,
        })),
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
  const existing = workspace.tracks.filter(isDemoTrack);
  if (existing.length) {
    examplesVisible = true;
    select(existing[0]);
    return;
  }
  const tracks = demoTracks();
  const loaded = commit(() => {
    ensureTrackCapacity(
      tracks.length,
      tracks.reduce((n, t) => n + t.points.length, 0),
    );
    workspace.tracks.push(...tracks);
    workspace.activeId = tracks[0].id;
    workspace.selection = { start: 0, end: tracks[0].points.length - 1 };
  });
  if (loaded) {
    examplesVisible = true;
    editWelcome = false;
    render();
    fitMap();
    notification(
      "Illustrative sample tracks loaded. Import your own GPX files to plan a real walk.",
    );
  }
}
$("demo").onclick = loadSampleTracks;
$("view-toggle").onclick = () => {
  showAll = !showAll;
  render();
  fitMap();
};
$("fit").onclick = fitMap;
function expandMap() {
  if (cardExpanded) toggleCard();
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
  editWelcome = !workspace.activeId && !workspace.route;
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
    `${dialogHeader("Settings", "", true)}<section class="settings-grid-section"><h3 id="grid-settings-heading">Grid references</h3><p class="system-picker-prompt">Choose a Grid Reference System.</p><label id="available-systems-heading" class="field-label system-picker-label" for="coordinate-system">Available Systems</label><select id="coordinate-system" class="text-input system-picker" aria-labelledby="available-systems-heading">${Object.entries(
      coordinateSystems,
    )
      .map(
        ([value, label]) =>
          `<option value="${value}" ${value === coordinateSystem ? "selected" : ""}>${label}</option>`,
      )
      .join(
        "",
      )}</select></section><h3 class="settings-colour-heading">Created Route Colour</h3>${colourForm(draft().color, true)}<p id="colour-status" class="dialog-note" role="status"></p><section class="settings-point-naming"><div class="settings-toggle-row"><h3 id="point-naming-heading">Allow Point Naming</h3><button id="allow-point-naming" class="settings-switch" type="button" role="switch" aria-labelledby="point-naming-heading" aria-describedby="point-naming-description" aria-checked="${allowPointNaming}"><span aria-hidden="true"></span></button></div><p id="point-naming-description">Allow individual points in a route to be named.</p></section><button class="button primary full" data-close>Done</button>`,
  );
  $("allow-point-naming").onclick = async () => {
    allowPointNaming = !allowPointNaming;
    $("allow-point-naming").setAttribute(
      "aria-checked",
      String(allowPointNaming),
    );
    render();
    try {
      await set(POINT_NAMING_KEY, allowPointNaming);
    } catch {
      notification(
        "Point naming changed for this session, but could not be saved on this device.",
        true,
      );
    }
  };
  bindColourPicker(draft().color, applyCreatedColour);
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
    `${dialogHeader("About", "BareGPS Route Planner · Create and Edit", true)}${aboutGuide}`,
    "about",
  );
window.addEventListener("keydown", (e) => {
  if (
    e.key === "Escape" &&
    cardExpanded &&
    !$<HTMLDialogElement>("dialog").open
  )
    toggleCard();
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
    allowPointNaming = (await get(POINT_NAMING_KEY)) === true;
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
