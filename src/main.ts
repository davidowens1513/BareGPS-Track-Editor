import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { simplifyTrack } from "./simplify";
import "./style.css";
import { aboutGuide } from "./about";
import { get, set } from "idb-keyval";
import { Capacitor } from "@capacitor/core";
import {
  analytics,
  COLORS,
  emptyWorkspace,
  MAX_POINTS,
  MAX_INPUT_POINTS,
  parseGPX,
  reverse,
  selectedPoints,
  validateWorkspace,
  restoreSeparateWorkspace,
  type Track,
  type Workspace,
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
import { TrackMap } from "./map";
import { InputMap } from "./input-map";
import {
  needsTerrain,
  trimInputTrack,
  insertInputPoint,
  deleteInputPoint,
  reshapeInputHandle,
  closeInputLoop,
  prepareInputTerrain,
  finishInputTerrain,
  type InputPointTool,
} from "./input-edit";
import { icon } from "./icons";
import { routecardText, routecardRows, SUMMARY_CARD_POINTS } from "./routecard";
import {
  addPlanSection,
  movePlanSection,
  buildPlannedRoute,
  allInputsInPlan,
  replacePlanSection,
} from "./route-plan";
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
const COORDINATE_KEY = "baregps-track-editor-coordinate-system-v1";
let allowPointNaming = false;
const POINT_NAMING_KEY = "baregps-track-editor-allow-point-naming-v1";
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
let previewReturnInputId: string | null = null;
let previewMode = false;
let showAll = true,
  expanded = false,
  busy = false,
  saveTimer: ReturnType<typeof setTimeout>,
  saveQueue = Promise.resolve();
let terrainController: AbortController | null = null;
const dismissedTileWarning = { create: false, edit: false };
import { isClosedRoute } from "./track-geometry";
let cardExpanded = false;
let inputEditing = false;
let inputTool: InputPointTool = "move";
let inputHandleInterval = 20;
let selectedInputPoint: number | null = null;
const INPUT_HANDLE_KEY = "baregps-track-editor-input-handle-interval-v1";
const visibleMap = () => map;
const STORAGE_KEY = "baregps-track-editor-workspace-v1";
const CONNECTION_ELEVATION_NOTE =
  "Connection distance is included. Connection ascent uses endpoint heights until you fetch terrain; intermediate hills may be missed.";
document.querySelector("#app")!.innerHTML = `
<header class="app-header"><a class="brand" href="#" aria-label="BareGPS Track Editor home"><img src="${import.meta.env.BASE_URL}logo.svg" alt="" width="40" height="40"><span class="brand-copy"><strong class="brand-title">BareGPS Track Editor</strong><span class="brand-subtitle">GPX Track Editing</span></span></a><div class="header-right"><div class="device-status"><span id="save-state" class="save-state" role="status" title="Your workspace is kept on this device. Use Save Route to export a GPX file."><span class="save-full">On your device</span><span class="save-short" aria-hidden="true">On device</span></span><div class="history" role="group" aria-label="Edit history"><button id="undo" class="icon-button" aria-label="Undo" title="Undo (⌘/Ctrl Z)">${icon("undo", 18)}</button><button id="redo" class="icon-button" aria-label="Redo" title="Redo (⌘/Ctrl Shift Z)">${icon("redo", 18)}</button></div></div><div class="header-utilities"><button id="help" class="icon-button" aria-label="About and keyboard shortcuts">${icon("help")}</button><button id="settings" class="icon-button" aria-label="Settings" title="Settings">${icon("settings", 19)}</button></div></div></header>
<main>
  <span id="track-count" class="sr-only">Your workspace</span>
  <section id="map-panel" class="map-panel" aria-label="Track map">
    <div class="map-toolbar"><span class="map-label">${icon("mountain", 18)}<strong>OpenTopoMap</strong><span class="terrain-label">TERRAIN</span></span><div class="map-actions"><button id="view-toggle" class="small-button">${icon("eye", 16)}<span>All tracks</span></button><span class="toolbar-divider"></span><button id="fit" class="icon-button" aria-label="Fit tracks to map" title="Fit tracks">${icon("fit", 18)}</button><button id="expand" class="icon-button" aria-label="Expand map" title="Expand map">${icon("expand", 18)}</button></div></div>
    <div id="edit-map-view" role="region" aria-label="Input track map"><div id="map"></div><button id="exit-preview" class="button secondary preview-mode" aria-label="Close Preview Mode" hidden><span aria-hidden="true">×</span> Preview Mode</button><button id="edit-locate" class="icon-button map-locate" aria-label="Go to current position" title="Go to current position">${icon("locate", 21)}</button><span id="edit-coordinates" class="map-coordinates" aria-label="Map centre coordinates"></span></div>
    <div id="input-edit-controls" hidden>
    <div id="input-point-tools" class="create-tools" role="group" aria-label="Input point editing tools" hidden><div class="drawing-modes" role="group" aria-label="Input drawing mode"><button id="input-move" aria-pressed="true" hidden>Move</button><button id="input-add" aria-pressed="false">Add points</button><button id="input-insert" aria-pressed="false">Insert point</button><button id="input-delete" disabled>Delete point</button><button id="input-close">Close loop</button></div><p id="input-point-status" class="sr-only" role="status"></p></div>
    <div id="input-extra-tools" class="create-tools input-extra-tools" role="group" aria-label="Input track actions" hidden><div class="drawing-modes"><button id="trim-before" disabled>Trim before</button><button id="trim-after" disabled>Trim after</button><button id="reverse" disabled>Reverse</button><button id="simplify-input">Simplify</button><button id="input-terrain" disabled>Fetch Terrain</button></div></div>
    <p id="input-selected-point" class="sr-only" role="status">Tap a map point to select it</p>
    <div id="input-plan-controls" class="input-plan-controls"></div>
    </div>
    <div id="map-empty" class="map-empty"><section class="edit-workflow" aria-labelledby="edit-workflow-title"><h2 id="edit-workflow-title">Your route in five steps</h2><ol aria-label="Edit workflow">${["Open Track", "Edit", "Add to Route Plan", "Confirm Plan", "Save/Share GPX"].map((step, i) => `<li><span class="workflow-number" aria-hidden="true">${i + 1}</span><span>${step}</span></li>`).join("")}</ol><div class="workflow-repeat" role="img" aria-label="Repeat steps 1 to 3 for more tracks"><svg viewBox="0 0 300 28" preserveAspectRatio="none" aria-hidden="true"><path d="M250 1C250 14 246 20 228 20H72C54 20 50 14 50 2M46 7L50 2L54 7" fill="none" stroke="currentColor" stroke-width="2.2" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/></svg><span aria-hidden="true">Repeat?</span></div><button id="empty-import" class="button primary">${icon("plus", 18)}Open Track</button></section></div>
    <div id="map-error" class="map-error" hidden><span>Some map tiles couldn’t load. Editing still works.</span><div class="map-warning-actions"><button id="retry-map" class="text-button">Retry</button><button id="dismiss-map" class="icon-button" aria-label="Dismiss map warning">${icon("close", 16)}</button></div></div>
    <div class="map-legend" id="map-legend" hidden><span><i class="legend-solid"></i>Recorded track</span><span><i class="legend-dashed"></i>Walking connection</span></div>
  </section>
  <section id="analytics" class="analytics" aria-label="Live track analytics"><div class="metric"><span>${icon("route", 17)} Distance(km)</span><strong id="distance">0.00</strong></div><div class="metric"><span>${icon("up", 17)} Ascent(m)</span><strong id="ascent">u/a</strong></div><div class="metric"><span>${icon("down", 17)} Descent(m)</span><strong id="descent">u/a</strong></div><div class="metric selection-metric"><span>${icon("pin", 17)} <span id="selection-caption">SELECTED TRACK</span></span><strong id="point-count">No track selected</strong><span id="analytics-source" class="metric-note">Open a file to begin</span></div></section>
  <section class="profile-card" aria-label="Elevation profile"><div class="profile-heading"><span>ELEVATION PROFILE</span><span id="profile-range"></span></div><div id="profile"></div><div class="profile-note-slot"><div id="elevation-note" class="elevation-note" role="status" aria-live="polite"></div></div></section>
  <div id="editor" class="editor-grid">
    <section class="card tracks-card"><div class="card-heading"><h2>Input Tracks <span id="source-count" class="badge">0</span></h2><button id="import" class="button secondary compact">${icon("plus", 16)}Open files</button></div><div id="track-list" class="track-list"></div></section>
    <div id="route-plan-controls" class="route-plan-controls"></div>
  </div>
  <section id="create-card" class="card create-card" aria-label="Route Card" hidden>
    <div class="card-heading"><h2>Route Card <span id="waypoint-count" class="badge">0</span></h2><button id="card-detail-toggle" class="button secondary compact" aria-pressed="false" hidden>Full Card</button><button id="expand-card" class="icon-button" aria-label="Expand Route Card" aria-expanded="false" title="Expand Route Card">${icon("expand", 18)}</button></div>
    <p id="card-summary-note" class="card-source-note" hidden></p><p id="card-source-note" class="card-source-note" hidden></p>
    <div class="create-settings"><label><span id="card-name-label">Route name</span><input id="create-name" class="text-input" maxlength="120" value=""></label><button id="preview-route" class="button secondary compact" hidden>${icon("eye", 17)}Preview</button></div>
    <div class="waypoint-scroll" role="region" aria-label="Route points" tabindex="0"><table class="waypoint-table"><caption class="sr-only">Route points in walking order</caption><colgroup><col class="point-col"><col class="name-col"><col class="grid-col"><col class="height-col"><col class="card-extra distance-col"><col class="card-extra cumulative-distance-col"><col class="card-extra ascent-col"><col class="card-extra cumulative-ascent-col"></colgroup><thead><tr><th scope="col">Point</th><th class="point-name-cell" scope="col">Name</th><th id="coordinate-heading" scope="col">Grid ref.</th><th scope="col">Height<span class="heading-unit">(m)</span></th><th class="card-extra distance-cell" scope="col">Distance<span class="heading-unit">(km)</span></th><th class="card-extra" scope="col">Cumul<br>Distance<span class="heading-unit">(km)</span></th><th class="card-extra" scope="col">Ascent<span class="heading-unit">(m)</span></th><th class="card-extra" scope="col">Cumul<br>Ascent<span class="heading-unit">(m)</span></th></tr></thead><tbody id="waypoint-rows"></tbody></table></div>
    <div class="card-share-actions card-extra"><button id="create-share" class="button secondary">${icon("export", 17)}Share Text</button><button id="create-pdf" class="button secondary">${icon("file", 17)}Share PDF</button></div>
    <div class="create-buttons"><button id="create-clear" class="button secondary">${icon("trash", 17)}Clear route</button><button id="create-save" class="button primary">${icon("export", 17)}Save Route</button></div>
  </section>
  <footer><span>Your files stay on your device. Map & terrain requests use the internet.</span></footer>
</main>
<div id="notice" class="notice" role="status" hidden></div>
<dialog id="dialog"><div id="dialog-content"></div></dialog>
`;
document.body.classList.toggle("web-route-card", !Capacitor.isNativePlatform());
const map = new InputMap(
  () => {},
  (failed) => {
    if (!failed) dismissedTileWarning.edit = false;
    $("map-error").hidden = !failed || dismissedTileWarning.edit;
  },
  {
    insert: (index, point) =>
      changeInput(
        (track) => insertInputPoint(track, index, point),
        index,
        inputTool === "insert" ? "move" : inputTool,
      ),
    move: (index, point, handles) =>
      changeInput(
        (track) => reshapeInputHandle(track, index, point, handles),
        index,
      ),
    select: (index) => {
      selectedInputPoint = index;
      updateInputSelectionControls();
    },
    preview: (track) => renderStats(track),
    status: (visible, total) => {
      $("input-point-status").textContent =
        `${total.toLocaleString()} handles · ${visible.toLocaleString()} shown · tap the line to reveal a point`;
    },
  },
);
new ResizeObserver(() => {
  const height = $("input-edit-controls").getBoundingClientRect().height;
  if (height)
    $("map-panel").style.setProperty("--input-controls-height", `${height}px`);
}).observe($("input-edit-controls"));
map.map.on("moveend resize", () => updateMapCoordinates("edit", map));
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
for (const name of ["edit"]) $(name + "-locate").onclick = goToCurrentPosition;
function renderLocationButtons() {
  for (const name of ["edit"]) {
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
const activeInput = () =>
  !editWelcome
    ? (workspace.tracks.find((track) => track.id === workspace.activeId) ??
      null)
    : null;
const displayTracks = () => workspace.tracks;
const displayMapTracks = () => [
  ...displayTracks(),
  ...(workspace.route ? [workspace.route] : []),
];
const allTracks = () => [
  ...workspace.tracks,
  ...(workspace.routePlan ?? []),
  ...(workspace.route ? [workspace.route] : []),
];
function notification(message: string, error = false, showSuccess = false) {
  // Routine actions stay quiet; warnings and errors remain visible until dismissed.
  if (!error && !showSuccess) return;
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
    `${full}. This refers to the workspace on this device; use Save Input Track or Save Route to export a GPX file.`;
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
      (undo[i].route?.points.length ?? 0) +
      (undo[i].routePlan ?? []).reduce(
        (count, track) => count + track.points.length,
        0,
      );
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
  previewMode = false;
  showAll = false;
  inputEditing = false;
  selectedInputPoint = null;
  inputTool = "move";
  map.resetSelection();
  editWelcome = false;
  workspace.activeId = track.id;
  workspace.selection = { start: 0, end: track.points.length - 1 };
  persist();
  render();
  fitMap();
}
function fitMap() {
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
function renderMap() {
  const tracks = editWelcome ? [] : displayMapTracks();
  const input = activeInput();
  const editing = !!input;
  if (map.inputId !== input?.id) {
    map.resetSelection();
    selectedInputPoint = null;
  }
  map.inputId = input?.id ?? null;
  map.pointEditing = editing;
  map.enabled = !busy;
  map.tool = inputTool;
  map.interval = inputHandleInterval;
  map.selectedIndex = selectedInputPoint;
  $("map").classList.toggle("input-drawing", editing && inputTool !== "move");
  map.render(
    tracks,
    editWelcome ? null : active(),
    workspace.selection,
    showAll,
  );
  $("map-empty").hidden = tracks.length > 0;
  $("map-legend").hidden = !tracks.length || editing;
}
function renderStats(preview?: Track) {
  const t = editWelcome ? null : (preview ?? active()),
    points = t ? selectedPoints(t, workspace.selection) : [],
    a = analytics(points);
  $("distance").innerHTML = `${km(a.length)}`;
  const hasElevation = points.some((p) => p.ele !== undefined);
  const totalsAvailable =
    hasElevation &&
    !a.missingEdges &&
    !a.estimatedGap &&
    !t?.terrainNeedsRefresh &&
    !points.some((p) => p.terrainPending);
  $("ascent").innerHTML = `${totalsAvailable ? metres(a.ascent) : "u/a"}${""}`;
  $("descent").innerHTML = `${totalsAvailable ? metres(a.descent) : "u/a"}`;
  $("point-count").textContent = t
    ? `${points.length.toLocaleString()} points`
    : "No track selected";
  $("analytics-source").textContent = t
    ? a.gapDistance
      ? `Includes ${km(a.gapDistance)} km of connections`
      : "Whole track · live totals"
    : "Open a file to begin";
  $("profile-range").textContent = hasElevation
    ? `${metres(a.min!)}–${metres(a.max!)} m · ${t!.name}`
    : "";
  const note = $("elevation-note");
  note.hidden = false;
  const needsRefresh =
    t?.terrainNeedsRefresh || points.some((point) => point.terrainPending);
  const status = !points.length
    ? "No track selected"
    : needsRefresh
      ? "Terrain needs refresh"
      : !hasElevation
        ? "Terrain not fetched"
        : a.missingEdges || a.estimatedGap
          ? "Terrain incomplete"
          : "Terrain up to date";
  const detail = !points.length
    ? ""
    : needsRefresh
      ? "Route geometry changed. Fetch terrain to update heights and ascent."
      : !hasElevation
        ? "Ascent and descent are unavailable until terrain is fetched."
        : a.missingEdges
          ? "Elevation is missing for some points. Ascent and descent are partial; distance includes the entire track."
          : a.estimatedGap
            ? CONNECTION_ELEVATION_NOTE
            : "Heights available for the whole track.";
  const label = document.createElement("strong");
  label.textContent = status;
  note.replaceChildren(label);
  if (detail) note.append(document.createTextNode(` · ${detail}`));
  note.dataset.state = !points.length
    ? "empty"
    : needsRefresh
      ? "refresh"
      : !hasElevation
        ? "missing"
        : a.missingEdges || a.estimatedGap
          ? "incomplete"
          : "ready";
  const profile = $("profile");
  if (!hasElevation) {
    profile.replaceChildren();
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
          return `<div class="track-row ${!editWelcome && t.id === workspace.activeId ? "active" : ""}"><button class="track-select" data-id="${t.id}" aria-pressed="${!editWelcome && t.id === workspace.activeId}"><span class="track-symbol" style="--track-color:${t.color}">${icon("route", 20)}</span><span class="track-text"><strong>${esc(t.name)}</strong><small>${km(a.length)} km <span>·</span> ${t.points.some((p) => p.ele !== undefined) ? `${metres(a.ascent)} m ↗` : "No elevation"} <span>·</span> ${t.points.length.toLocaleString()} pts</small></span>${!editWelcome && t.id === workspace.activeId ? '<span class="active-dot"></span>' : icon("chevron", 15)}</button><button class="icon-button rename-track" data-rename-id="${t.id}" aria-label="Rename ${esc(t.name)}" title="Rename track">${icon("edit", 17)}</button><button class="color-trigger input-track-colour" data-colour-id="${t.id}" style="--line-colour:${t.color}" aria-label="Choose line colour for ${esc(t.name)}" title="Choose track line colour"></button><span class="input-plan-status"${allInputsInPlan([t], workspace.routePlan ?? []) ? ` role="img" aria-label="In Route Plan" title="All or part of this input is in the Route Plan">${icon("check", 18)}` : ' aria-hidden="true">'}</span><button class="icon-button delete-track" data-id="${t.id}" aria-label="Remove ${esc(t.name)}" title="Remove track">${icon("trash", 16)}</button></div>`;
        })
        .join("")
    : '<div class="tracks-empty"><p>Open one or more GPX files.</p></div>';
  list.querySelectorAll<HTMLButtonElement>(".track-select").forEach(
    (b) =>
      (b.onclick = () => {
        if (!busy) select(workspace.tracks.find((t) => t.id === b.dataset.id)!);
      }),
  );
  list
    .querySelectorAll<HTMLButtonElement>("[data-rename-id]")
    .forEach((button) => {
      button.onclick = () => {
        if (busy) return;
        const track = workspace.tracks.find(
          (track) => track.id === button.dataset.renameId,
        );
        if (track) rename(track);
      };
    });
  list
    .querySelectorAll<HTMLButtonElement>("[data-colour-id]")
    .forEach((button) => {
      button.onclick = () => {
        if (busy) return;
        const track = workspace.tracks.find(
          (t) => t.id === button.dataset.colourId,
        );
        if (track)
          openColourPicker(track.color, (color) => {
            const current = workspace.tracks.find((t) => t.id === track.id);
            if (current && current.color !== color)
              commit(() => replace({ ...current, color }));
          });
      };
    });
  list
    .querySelectorAll<HTMLButtonElement>(".delete-track")
    .forEach((button) => {
      button.onclick = () => {
        const track = workspace.tracks.find(
          (track) => track.id === button.dataset.id,
        );
        if (!track || busy) return;
        confirmRemoval(
          `Remove ${track.name}?`,
          "Remove this input from the workspace? Its original file, saved plan copies and confirmed route stay in place. You can undo this change.",
          () =>
            commit(() => {
              workspace.tracks = workspace.tracks.filter(
                (t) => t.id !== track.id,
              );
              if (workspace.activeId === track.id) {
                const next = workspace.tracks[0] ?? workspace.route;
                workspace.activeId = next?.id ?? null;
                workspace.selection = {
                  start: 0,
                  end: next ? next.points.length - 1 : 0,
                };
              }
            }),
          "Remove track",
        );
      };
    });
}
function renderControls() {
  const t = editWelcome ? null : active(),
    box = $("input-plan-controls");
  $("route-plan-controls").innerHTML =
    `<button id="open-route-plan" class="button primary full" aria-label="Route Plan">Route Plan <span class="badge" aria-hidden="true">${workspace.routePlan?.length ?? 0}</span></button>`;
  $("open-route-plan").onclick = routePlanDialog;
  if (!t || t === workspace.route) {
    inputEditing = false;
    selectedInputPoint = null;
    box.innerHTML = `<button class="button primary full" disabled>Add to Route Plan</button>`;
    $("open-route-plan").onclick = routePlanDialog;
    return;
  }
  inputEditing = true;
  workspace.selection = { start: 0, end: t.points.length - 1 };
  box.innerHTML = `<button id="add-route" class="button primary full">Add to Route Plan</button>`;
  $("add-route").onclick = () => {
    if (busy || t === workspace.route) return;
    if (
      commit(() => {
        workspace.routePlan = addPlanSection(workspace.routePlan ?? [], t);
        if (allInputsInPlan(workspace.tracks, workspace.routePlan)) {
          workspace.activeId = null;
          workspace.selection = { start: 0, end: 0 };
          showAll = true;
        }
        ensureTrackCapacity(0, 0);
      })
    ) {
      selectedPlanId = workspace.routePlan!.at(-1)!.id;
      routePlanDialog();
    }
  };
  $("open-route-plan").onclick = routePlanDialog;
}
function updateInputSelectionControls() {
  const track = activeInput();
  $<HTMLButtonElement>("simplify-input").disabled = busy || !track;
  if (selectedInputPoint !== null && !track?.points[selectedInputPoint])
    selectedInputPoint = null;
  $<HTMLButtonElement>("input-delete").disabled =
    busy || selectedInputPoint === null || !track || track.points.length <= 2;
  const before = $<HTMLButtonElement>("trim-before"),
    after = $<HTMLButtonElement>("trim-after");
  if (before)
    before.disabled =
      busy ||
      !track ||
      selectedInputPoint === null ||
      selectedInputPoint === 0 ||
      selectedInputPoint >= track.points.length - 1;
  if (after)
    after.disabled =
      busy ||
      !track ||
      selectedInputPoint === null ||
      selectedInputPoint < 1 ||
      selectedInputPoint === track.points.length - 1;
  const label = $("input-selected-point");
  if (label)
    label.textContent =
      selectedInputPoint === null
        ? "Tap a map point to select it"
        : `Point ${selectedInputPoint + 1} selected`;
}
function changeInput(
  change: (track: Track) => Track,
  selected: number | null = null,
  tool = inputTool,
): boolean {
  const source = activeInput();
  if (busy || !inputEditing || !source) return false;
  const succeeded = commit(() => {
    const changed = change(source);
    ensureTrackCapacity(0, changed.points.length - source.points.length);
    workspace.tracks = workspace.tracks.map((track) =>
      track.id === source.id ? changed : track,
    );
    workspace.selection = { start: 0, end: changed.points.length - 1 };
    selectedInputPoint =
      selected === null ? null : Math.min(selected, changed.points.length - 1);
    inputTool = tool;
    map.resetSelection();
  });
  if (!succeeded) render();
  return succeeded;
}
for (const tool of ["move", "add", "insert"] as const)
  $("input-" + tool).onclick = () => {
    if (!busy && activeInput()) {
      if (!inputEditing) {
        inputEditing = true;
        selectedInputPoint = null;
        map.resetSelection();
        workspace.selection = {
          start: 0,
          end: activeInput()!.points.length - 1,
        };
        showAll = false;
        persist();
      }
      inputTool = tool;
      render();
    }
  };
$("input-delete").onclick = () => {
  if (selectedInputPoint !== null) {
    const index = selectedInputPoint;
    confirmRemoval(
      `Delete Input Point ${index + 1}?`,
      "Remove this point from the selected input? Plan copies and the confirmed route stay unchanged. You can undo this change.",
      () =>
        changeInput((track) => deleteInputPoint(track, index), index, "move"),
    );
  }
};
$("input-close").onclick = () => {
  if (busy || !activeInput()) return;
  if (!inputEditing) {
    inputEditing = true;
    workspace.selection = { start: 0, end: activeInput()!.points.length - 1 };
    selectedInputPoint = null;
    map.resetSelection();
  }
  changeInput(closeInputLoop, null, "move");
};
$("reverse").onclick = () => {
  const track = activeInput();
  if (!track || busy) return;
  const selected = selectedInputPoint;
  changeInput(
    reverse,
    selected === null ? null : track.points.length - 1 - selected,
    "move",
  );
};
for (const direction of ["before", "after"] as const)
  $("trim-" + direction).onclick = () => {
    if (selectedInputPoint === null) return;
    const index = selectedInputPoint;
    const count =
      direction === "before"
        ? index
        : (activeInput()?.points.length ?? 0) - index - 1;
    if (count <= 0 || busy) return;
    confirmRemoval(
      `Trim ${direction} Point ${index + 1}?`,
      `Remove ${count.toLocaleString()} ${count === 1 ? "point" : "points"} ${direction} the selected point? The selected point is kept. You can undo this change.`,
      () =>
        changeInput(
          (track) => trimInputTrack(track, index, direction),
          direction === "before" ? 0 : index,
          "move",
        ),
      `Trim ${direction}`,
    );
  };
bindInputActions();
function previewSimplification() {
  const original = activeInput();
  if (busy || !original) return;
  let result: ReturnType<typeof simplifyTrack>;
  try {
    result = simplifyTrack(original);
  } catch (error) {
    report(error);
    return;
  }
  const candidate = result.track;
  const tooLarge = candidate.points.length > MAX_POINTS;
  openDialog(
    `${dialogHeader("Preview Simplified Track")}<p class="dialog-note">Target: 10 handles/km. Maximum deviation: 10 metres. Extra points keep bends, named points and gaps.</p><p class="simplify-counts"><strong>${original.points.length.toLocaleString()} → ${candidate.points.length.toLocaleString()} points</strong><br>${result.handlesPerKm.toFixed(1)} handles/km · Maximum deviation ${result.maxDeviation.toFixed(1)} m</p><div class="simplify-legend"><label><input type="checkbox" id="simplify-show-original" checked><span class="original-line"></span>Original</label><label><input type="checkbox" id="simplify-show-copy" checked><span class="simplified-line"></span>Simplified</label></div><div id="simplify-map" aria-label="Compare original and simplified tracks"></div><p class="dialog-note">Accept creates a separate Input Track. The original, Route Plan and confirmed route stay unchanged. Each handle in the copy controls one point; zoom in if some handles are hidden. Changed connections need terrain refreshed. ${tooLarge ? "This shape needs more than 5,000 points within 10 metres; it cannot be accepted for planning." : ""}</p><div class="dialog-actions"><button id="cancel-simplify" class="button secondary">Cancel</button><button id="accept-simplify" class="button primary" ${tooLarge ? "disabled" : ""}>Accept simplified copy</button></div>`,
  );
  const preview = L.map("simplify-map", {
    preferCanvas: true,
    zoomControl: true,
  });
  L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
    maxZoom: 17,
    attribution: "Map © OpenStreetMap contributors · OpenTopoMap (CC-BY-SA)",
  }).addTo(preview);
  const lines = (track: Track, color: string, weight: number) => {
    const group = L.layerGroup();
    let segment: L.LatLngTuple[] = [];
    for (const point of track.points) {
      if (point.gapBefore && segment.length) {
        if (segment.length > 1)
          L.polyline(segment, { color, weight }).addTo(group);
        const last = segment.at(-1)!;
        L.polyline([last, [point.lat, point.lon]], {
          color,
          weight,
          dashArray: "5 6",
        }).addTo(group);
        segment = [];
      }
      segment.push([point.lat, point.lon]);
    }
    if (segment.length > 1) L.polyline(segment, { color, weight }).addTo(group);
    return group.addTo(preview);
  };
  const originalLayer = lines(original, "#89908b", 6);
  const copyLayer = lines(candidate, "#16724d", 3);
  preview.fitBounds(
    L.latLngBounds(original.points.map((p) => [p.lat, p.lon] as L.LatLngTuple)),
    { padding: [15, 15], maxZoom: 16 },
  );
  for (const [id, layer] of [
    ["simplify-show-original", originalLayer],
    ["simplify-show-copy", copyLayer],
  ] as const)
    $<HTMLInputElement>(id).onchange = (event) => {
      if ((event.target as HTMLInputElement).checked) layer.addTo(preview);
      else preview.removeLayer(layer);
    };
  const close = () => {
    preview.remove();
    $<HTMLDialogElement>("dialog").close();
  };
  bindDialogClose(close);
  $<HTMLDialogElement>("dialog").oncancel = (event) => {
    event.preventDefault();
    close();
  };
  $("cancel-simplify").onclick = close;
  $("accept-simplify").onclick = () => {
    if (tooLarge) return;
    if (
      commit(() => {
        ensureTrackCapacity(1, candidate.points.length);
        workspace.tracks.push(candidate);
        workspace.activeId = candidate.id;
        workspace.selection = { start: 0, end: candidate.points.length - 1 };
        editWelcome = false;
        selectedInputPoint = null;
        map.resetSelection();
      }, true)
    )
      close();
  };
  requestAnimationFrame(() => preview.invalidateSize());
}
function bindInputActions() {
  $("simplify-input").onclick = previewSimplification;
  $("input-terrain").onclick = () => {
    const source = activeInput();
    if (busy || !inputEditing || !source || !needsTerrain(source)) return;
    openDialog(
      `${dialogHeader("Fetch Input Terrain")}<p>Coordinates for missing heights and changed legs are sent to Open Topo Data to estimate terrain. Existing valid recorded heights are kept. Your input changes only when fetching completes.</p><div class="dialog-actions"><button class="button secondary" data-close>Cancel</button><button id="confirm-input-terrain" class="button primary">Fetch Terrain</button></div>`,
    );
    $("confirm-input-terrain").onclick = async () => {
      busy = true;
      terrainController = new AbortController();
      render();
      $("dialog-content").innerHTML =
        `${dialogHeader("Fetching Input Terrain")}<p id="input-terrain-progress" role="status">Preparing changed legs…</p><div class="dialog-actions"><button id="cancel-input-terrain" class="button secondary">Cancel</button></div>`;
      bindTerrainCancellation("cancel-input-terrain");
      try {
        const sampled = await enrichTerrain(
          prepareInputTerrain(source),
          (message) => {
            $("input-terrain-progress").textContent = message;
          },
          terrainController.signal,
        );
        const refreshed = finishInputTerrain(source, sampled);
        ensureTrackCapacity(0, refreshed.points.length - source.points.length);
        checkpoint();
        workspace.tracks = workspace.tracks.map((track) =>
          track.id === source.id ? refreshed : track,
        );
        workspace.selection = { start: 0, end: refreshed.points.length - 1 };
        selectedInputPoint = null;
        map.resetSelection();
        persist();
        notification(
          "Changed input legs now include terrain estimates. Route Plan copies and the confirmed route are unchanged.",
        );
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
}
let selectedPlanId: string | null = null;
function routePlanDialog() {
  if (busy) return;
  const plan = workspace.routePlan ?? [];
  const replacementInput = activeInput();
  if (!plan.some((track) => track.id === selectedPlanId))
    selectedPlanId = plan[0]?.id ?? null;
  const index = plan.findIndex((track) => track.id === selectedPlanId);
  const pending =
    !workspace.route ||
    JSON.stringify(workspace.confirmedPlan ?? []) !==
      JSON.stringify(plan.map((track) => track.id));
  openDialog(
    `${dialogHeader("Route Plan", "Select a track, then move it up or down to set the walking order.", true)}
    <p class="dialog-note">${pending ? "Confirm Plan fetches missing heights and connections from Open Topo Data, then builds the route in this order. The Route Card stays unchanged until completion." : "This order is confirmed. Changes take effect when you confirm again."}</p>
    <div class="plan-scroll" role="region" aria-label="Route Plan tracks" tabindex="0"><table class="plan-grid"><thead><tr><th scope="col">Order</th><th scope="col">Track</th><th scope="col">Points</th><th scope="col">Distance<br>(km)</th></tr></thead><tbody>${plan.length ? plan.map((track, i) => `<tr data-plan-id="${track.id}" class="${track.id === selectedPlanId ? "selected" : ""}"><td>${i + 1}</td><td><button class="plan-select" aria-pressed="${track.id === selectedPlanId}" data-select-plan="${track.id}">${esc(track.name)}</button></td><td>${track.points.length.toLocaleString()}</td><td>${km(analytics(track.points).length)}</td></tr>`).join("") : '<tr><td colspan="4" class="plan-empty">No tracks yet. Edit an input track and choose Add to Route Plan.</td></tr>'}</tbody></table></div>
    <div class="plan-row-actions"><button id="plan-up" class="button secondary compact" ${index <= 0 ? "disabled" : ""}>Move up</button><button id="plan-down" class="button secondary compact" ${index < 0 || index === plan.length - 1 ? "disabled" : ""}>Move down</button><button id="plan-remove" class="button secondary compact" ${index < 0 ? "disabled" : ""}>Remove</button></div>
    <button id="plan-replace" class="button secondary compact" ${!replacementInput ? "hidden" : ""} ${index < 0 ? "disabled" : ""}>Replace selected track with current input</button>
    <div class="dialog-actions"><button class="button secondary" data-close>Keep adding</button><button id="confirm-route-plan" class="button primary" ${!plan.length ? "disabled" : ""}>Confirm Plan</button></div>`,
    "plan",
  );
  const choose = (id: string) => {
    selectedPlanId = id;
    $("dialog-content")
      .querySelectorAll<HTMLElement>("[data-plan-id]")
      .forEach((row) =>
        row.classList.toggle("selected", row.dataset.planId === id),
      );
    $("dialog-content")
      .querySelectorAll<HTMLButtonElement>("[data-select-plan]")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.selectPlan === id),
        ),
      );
    const selected = plan.findIndex((track) => track.id === id);
    $<HTMLButtonElement>("plan-up").disabled = selected <= 0;
    $<HTMLButtonElement>("plan-down").disabled =
      selected < 0 || selected === plan.length - 1;
    $<HTMLButtonElement>("plan-remove").disabled = selected < 0;
    $<HTMLButtonElement>("plan-replace").disabled = selected < 0;
  };
  $("dialog-content")
    .querySelectorAll<HTMLElement>("[data-plan-id]")
    .forEach((row) => {
      row.onclick = () => choose(row.dataset.planId!);
    });
  const move = (step: number) => {
    const from = (workspace.routePlan ?? []).findIndex(
        (track) => track.id === selectedPlanId,
      ),
      to = from + step;
    if (from < 0 || to < 0 || to >= (workspace.routePlan?.length ?? 0)) return;
    if (
      commit(() => {
        workspace.routePlan = movePlanSection(workspace.routePlan!, from, to);
      })
    ) {
      routePlanDialog();
      const row = Array.from(
        $("dialog-content").querySelectorAll<HTMLButtonElement>(
          "[data-select-plan]",
        ),
      ).find((button) => button.dataset.selectPlan === selectedPlanId);
      row?.focus({ preventScroll: true });
      row?.scrollIntoView({ block: "nearest" });
    }
  };
  $("plan-up").onclick = () => move(-1);
  $("plan-down").onclick = () => move(1);
  $("dialog-content")
    .querySelectorAll<HTMLButtonElement>("[data-select-plan]")
    .forEach((button) => {
      button.onkeydown = (event) => {
        if (
          event.altKey &&
          (event.key === "ArrowUp" || event.key === "ArrowDown")
        ) {
          event.preventDefault();
          selectedPlanId = button.dataset.selectPlan!;
          move(event.key === "ArrowUp" ? -1 : 1);
        }
      };
    });
  $("plan-replace").onclick = () => {
    if (!replacementInput || busy) return;
    const index = (workspace.routePlan ?? []).findIndex(
      (t) => t.id === selectedPlanId,
    );
    if (index < 0) return;
    if (
      commit(() => {
        const replacement = replacePlanSection(
          workspace.routePlan!,
          index,
          replacementInput,
          { start: 0, end: replacementInput.points.length - 1 },
        );
        const delta =
          replacement[index].points.length -
          workspace.routePlan![index].points.length;
        ensureTrackCapacity(0, delta);
        workspace.routePlan = replacement;
        selectedPlanId = replacement[index].id;
      })
    )
      routePlanDialog();
  };
  $("plan-remove").onclick = () => {
    const from = (workspace.routePlan ?? []).findIndex(
      (track) => track.id === selectedPlanId,
    );
    if (from < 0 || busy) return;
    const entry = workspace.routePlan![from];
    confirmRemoval(
      `Remove ${entry.name} from Route Plan?`,
      "Remove this saved plan entry? The input track and previously confirmed route stay unchanged. You can undo this change.",
      () => {
        if (
          commit(() => {
            workspace.routePlan = workspace.routePlan!.filter(
              (track) => track.id !== entry.id,
            );
          })
        ) {
          selectedPlanId =
            workspace.routePlan![
              Math.min(from, workspace.routePlan!.length - 1)
            ]?.id ?? null;
          routePlanDialog();
        }
      },
      "Remove from plan",
      routePlanDialog,
    );
  };
  $("confirm-route-plan").onclick = confirmRoutePlan;
}
function applyConfirmedPlan(route: Track, ids: string[]) {
  if (
    commit(() => {
      ensureTrackCapacity(
        0,
        route.points.length - (workspace.route?.points.length ?? 0),
      );
      workspace.route = route;
      workspace.confirmedPlan = ids;
      workspace.activeId = route.id;
      workspace.selection = { start: 0, end: route.points.length - 1 };
      editWelcome = false;
      showAll = false;
    }, true)
  )
    $<HTMLDialogElement>("dialog").close();
}
async function confirmRoutePlan() {
  if (busy || !workspace.routePlan?.length) return;
  const ids = workspace.routePlan.map((track) => track.id);
  const unchanged =
    workspace.route &&
    JSON.stringify(ids) === JSON.stringify(workspace.confirmedPlan ?? []);
  let candidate: Track;
  try {
    candidate = unchanged
      ? workspace.route!
      : buildPlannedRoute(workspace.routePlan, workspace.route);
  } catch (error) {
    report(error);
    return;
  }
  if (!needsTerrain(candidate)) {
    applyConfirmedPlan(candidate, ids);
    return;
  }
  busy = true;
  terrainController = new AbortController();
  render();
  openDialog(
    `${dialogHeader("Fetching Route Plan Terrain")}<p class="dialog-note">Missing and changed leg coordinates are sent to Open Topo Data. Recorded heights are kept.</p><p id="plan-terrain-progress" role="status">Preparing terrain…</p><div class="dialog-actions"><button id="cancel-plan-terrain" class="button secondary">Cancel</button></div>`,
  );
  bindTerrainCancellation("cancel-plan-terrain");
  let refreshed: Track | undefined;
  let failure: unknown;
  try {
    refreshed = finishInputTerrain(
      candidate,
      await enrichTerrain(
        prepareInputTerrain(candidate),
        (message) => {
          $("plan-terrain-progress").textContent = message;
        },
        terrainController.signal,
      ),
    );
    ensureTrackCapacity(
      0,
      refreshed.points.length - (workspace.route?.points.length ?? 0),
    );
  } catch (error) {
    failure = error;
  } finally {
    busy = false;
    terrainController = null;
    $<HTMLDialogElement>("dialog").oncancel = null;
    render();
  }
  if (refreshed && !failure) {
    applyConfirmedPlan(refreshed, ids);
    return;
  }
  if (isCancelled(failure)) {
    routePlanDialog();
    return;
  }
  const message =
    failure instanceof Error
      ? failure.message
      : "Terrain could not be fetched.";
  openDialog(
    `${dialogHeader("Terrain Unavailable")}<p role="alert">${esc(message)}</p><p class="dialog-note">Your plan and previous confirmed route are unchanged. Confirming without terrain leaves heights incomplete and ascent partial.</p><div class="terrain-failure-actions"><button id="retry-plan-terrain" class="button primary">Retry terrain</button><button id="confirm-without-terrain" class="button secondary">Confirm without terrain</button><button id="back-to-plan" class="button secondary">Back to Route Plan</button></div>`,
  );
  $("retry-plan-terrain").onclick = confirmRoutePlan;
  $("confirm-without-terrain").onclick = () =>
    applyConfirmedPlan(candidate, ids);
  $("back-to-plan").onclick = routePlanDialog;
}
function render() {
  $("exit-preview").hidden = !previewMode;
  $<HTMLButtonElement>("exit-preview").disabled = busy;
  renderTracks();
  renderControls();
  renderLayout();
  renderPointCard();
  renderStats();
  renderMap();
  $<HTMLButtonElement>("undo").disabled = !undo.length || busy;
  $<HTMLButtonElement>("redo").disabled = !redo.length || busy;
  $("view-toggle").innerHTML =
    `${icon("eye", 16)}<span>${showAll ? "All tracks" : "Selected track"}</span>`;
  for (const id of ["import", "empty-import", "view-toggle"])
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
        "fit",
      ].includes(b.id)
    )
      b.disabled = true;
  });
  const input = activeInput();
  $("input-edit-controls").hidden = false;
  $("input-point-tools").hidden = false;
  $("input-extra-tools").hidden = false;
  $<HTMLButtonElement>("reverse").disabled = busy || !input;
  for (const tool of ["move", "add", "insert"] as const) {
    $("input-" + tool).setAttribute(
      "aria-pressed",
      String(inputEditing && inputTool === tool),
    );
    $<HTMLButtonElement>("input-" + tool).disabled = busy || !input;
  }
  $<HTMLButtonElement>("input-close").disabled =
    busy || !input || input.points.length < 3 || isClosedRoute(input);
  const inputTerrain = $<HTMLButtonElement>("input-terrain");
  if (inputTerrain)
    inputTerrain.disabled = busy || !input || !needsTerrain(input);
  updateInputSelectionControls();
  renderLocationButtons();
}
function ensureTrackCapacity(count: number, points: number) {
  if (workspace.tracks.length + count > 100)
    throw new Error(
      "The workspace can hold 100 tracks. Remove some tracks before adding more.",
    );
  if (
    allTracks().reduce((n, t) => n + t.points.length, 0) + points >
    MAX_INPUT_POINTS * 4
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
        const parsed = parseGPX(
          file.text,
          file.name,
          workspace.tracks.length + tracks.length,
          MAX_INPUT_POINTS,
        );
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
      editWelcome = false;
      workspace.activeId = tracks[0].id;
      showAll = false;
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
        `${tracks.length} ${tracks.length === 1 ? "track" : "tracks"} imported. Select a point to edit or trim the input track.`,
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
    if (await saveTrack(track, "Edited Route"))
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
function openDialog(content: string, variant?: "about" | "plan") {
  $("dialog").classList.toggle("plan-dialog", variant === "plan");
  $("dialog").classList.toggle("about-dialog", variant === "about");
  $("dialog-content").innerHTML = content;
  $<HTMLDialogElement>("dialog").showModal();
  $("dialog").setAttribute("aria-labelledby", "dialog-title");
  bindDialogClose();
}
function bindDialogClose(cancel?: () => void) {
  const dialog = $<HTMLDialogElement>("dialog");
  $("dialog-content")
    .querySelectorAll<HTMLButtonElement>("[data-close]")
    .forEach((button) => {
      button.onclick = () => (cancel ? cancel() : dialog.close());
      if (button.closest(".dialog-heading")) {
        button.setAttribute(
          "aria-label",
          cancel ? "Cancel operation" : "Close dialog",
        );
        button.title = cancel ? "Cancel operation" : "Close dialog";
      }
    });
  dialog.oncancel = cancel
    ? (event) => {
        event.preventDefault();
        cancel();
      }
    : null;
}
function bindTerrainCancellation(buttonId: string) {
  const controller = terrainController;
  const cancel = () => {
    controller?.abort();
    if (Capacitor.isNativePlatform())
      notification(
        "Terrain cancelled. The current network request may finish in the background; its result will be ignored.",
      );
  };
  bindDialogClose(cancel);
  $(buttonId).onclick = cancel;
}
function confirmRemoval(
  title: string,
  message: string,
  action: () => unknown,
  confirmLabel = "Delete point",
  cancel?: () => void,
) {
  if (busy) return;
  openDialog(
    `${dialogHeader(esc(title))}<p>${esc(message)}</p><div class="dialog-actions"><button id="cancel-delete" class="button secondary" autofocus>Cancel</button><button id="confirm-delete" class="button primary">${esc(confirmLabel)}</button></div>`,
  );
  const dialog = $<HTMLDialogElement>("dialog");
  const finish = (confirmed: boolean) => {
    dialog.oncancel = null;
    dialog.close();
    if (confirmed) action();
    else cancel?.();
  };
  $("cancel-delete").onclick = () => finish(false);
  $("confirm-delete").onclick = () => finish(true);
  // The title-bar close control and Escape have the same non-destructive result.
  dialog.querySelector<HTMLButtonElement>(
    ".dialog-heading [data-close]",
  )!.onclick = () => finish(false);
  dialog.oncancel = (event) => {
    event.preventDefault();
    finish(false);
  };
}
function dialogHeader(title: string, subtitle = "", branded = false) {
  return `<div class="dialog-heading${branded ? " branded-dialog-heading" : ""}"><div class="dialog-heading-content">${branded ? `<img class="dialog-logo" src="${import.meta.env.BASE_URL}logo.svg" alt="BareGPS" width="36" height="36">` : ""}<div><h2 id="dialog-title">${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ""}</div></div><button class="icon-button" data-close aria-label="Close dialog">${icon("close", 20)}</button></div>`;
}
function colourForm(initial: string) {
  return `<form id="colour-form"><hex-color-picker id="colour-spectrum" color="${initial}"></hex-color-picker><div class="colour-presets" role="group" aria-label="Preset colours">${COLORS.map((color) => `<button type="button" class="colour-preset" data-colour="${color}" style="--line-colour:${color}" aria-label="Use ${color}" aria-pressed="${color === initial}"></button>`).join("")}</div><label class="field-label" for="colour-hex">Hex colour</label><div class="colour-value"><span id="colour-preview" style="--line-colour:${initial}" aria-hidden="true"></span><input id="colour-hex" class="text-input" value="${initial.toUpperCase()}" pattern="#[0-9A-Fa-f]{6}" maxlength="7" spellcheck="false" autocapitalize="characters" required title="Use # followed by six hexadecimal characters"></div><div class="dialog-actions"><button type="button" class="button secondary" data-close>Cancel</button><button class="button primary">Apply colour</button></div></form>`;
}
function openColourPicker(initial: string, apply: (color: string) => void) {
  openDialog(
    `${dialogHeader("Line Colour", "Choose a colour for this input track.")}${colourForm(initial)}`,
  );
  bindColourPicker(apply);
}
function bindColourPicker(apply: (color: string) => void) {
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
    $<HTMLDialogElement>("dialog").close();
  };
}
function rename(track: Track) {
  openDialog(
    `${dialogHeader("Rename Input Track")}<form id="rename-form"><label class="field-label" for="track-name">Track name</label><input id="track-name" class="text-input" maxlength="120" value="${esc(track.name)}" required><div class="dialog-actions"><button type="button" class="button secondary" data-close>Cancel</button><button class="button primary">Save name</button></div></form>`,
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
function renderLayout() {
  updateMapCoordinates("edit", map);
  document.body.classList.toggle("point-naming", allowPointNaming);
  $("edit-map-view").hidden = false;
  $("editor").hidden = false;
  $("create-card").hidden = false;
  $("view-toggle").hidden = editWelcome;
  $("selection-caption").textContent = "SELECTED TRACK";
  $("map-panel").setAttribute("aria-label", "Track map");
  $("map-error").hidden = !map.hasTileError() || dismissedTileWarning.edit;
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
  const source = workspace.route;
  if (!source) return null;
  return {
    route: source,
    terrain: undefined,
    source,
    offset: 0,
    description: `Whole joined route · ${source.points.length} points${needsTerrain(source) ? " · Terrain incomplete — ascent is partial" : ""}`,
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
    empty.colSpan =
      !Capacitor.isNativePlatform() && !cardExpanded
        ? (allowPointNaming ? 8 : 7) + 0
        : cardExpanded
          ? allowPointNaming
            ? 8
            : 7
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
let fullRouteCard = false;
$("card-detail-toggle").onclick = () => {
  fullRouteCard = !fullRouteCard;
  renderPointCard();
};
let cardSourceKey = "";
let cardScrollFrame = 0;
function renderPointCard() {
  if (cardScrollFrame) cancelAnimationFrame(cardScrollFrame);
  cardScrollFrame = 0;
  const context = routeCardContext();
  const route = context?.route ?? emptyCardRoute;
  const points = route.points;
  const offset = context?.offset ?? 0;
  const rows = routecardRows(route, context?.terrain, fullRouteCard);
  $("waypoint-count").textContent = String(rows.length);
  const detailToggle = $<HTMLButtonElement>("card-detail-toggle");
  detailToggle.hidden = points.length <= SUMMARY_CARD_POINTS;
  detailToggle.disabled = busy;
  detailToggle.textContent = fullRouteCard ? "Summary Card" : "Full Card";
  detailToggle.setAttribute("aria-pressed", String(fullRouteCard));
  const summaryNote = $("card-summary-note");
  summaryNote.hidden = points.length <= SUMMARY_CARD_POINTS;
  summaryNote.textContent = `${fullRouteCard ? "Full card" : "Summary card"}: ${rows.length} of ${points.length} route points. ${!fullRouteCard && rows.length > SUMMARY_CARD_POINTS ? "All named points retained; more than 30 checkpoints. " : ""}Distances and ascent use the full route. GPX keeps every point.`;
  const nameField = $<HTMLInputElement>("create-name");
  nameField.value = route.name;
  nameField.readOnly = false;
  $("preview-route").hidden = !context;
  $<HTMLButtonElement>("preview-route").disabled = busy || !context;
  nameField.closest<HTMLElement>(".create-settings")!.hidden = !context;
  $("card-name-label").textContent =
    context?.source === workspace.route ? "Route name" : "Input track";
  $("card-source-note").hidden = !context;
  $("card-source-note").textContent = context?.description ?? "";
  $("create-save").setAttribute("aria-label", "Save Route");
  $("create-save").innerHTML = `${icon("export", 17)}Save Route`;
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
  const table =
    $("create-card").querySelector<HTMLTableElement>(".waypoint-table")!;
  const scroller = table.parentElement!;
  const key = `${context?.source.id}:${offset}:${points.length}:${cardExpanded}:${fullRouteCard}`;
  if (cardSourceKey !== key) {
    scroller.scrollTop = 0;
    cardSourceKey = key;
  }
  const virtual = rows.length > 400;
  table.classList.toggle("virtual-card-table", virtual);
  table.setAttribute("aria-rowcount", String(rows.length + 1));
  table.style.removeProperty("--virtual-row-height");
  delete table.dataset.virtualRowHeight;
  let rowHeight = 36;
  let lastFirst = -1,
    lastEnd = -1;
  const colspan =
    !Capacitor.isNativePlatform() && !cardExpanded
      ? (allowPointNaming ? 8 : 7) + 0
      : cardExpanded
        ? allowPointNaming
          ? 8
          : 7
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
    const end = virtual ? Math.min(rows.length, first + 100) : rows.length;
    if (first === lastFirst && end === lastEnd) return;
    lastFirst = first;
    lastEnd = end;
    const topSpacer = virtual && first > 0 ? spacer(first) : "";
    const bottomSpacer =
      virtual && end < rows.length ? spacer(rows.length - end) : "";
    $("waypoint-rows").innerHTML = points.length
      ? topSpacer +
        rows
          .slice(first, end)
          .map((row, localIndex) => {
            const i = row.index;
            const point = row.point;
            const coordinate = formatCoordinate(point, coordinateSystem);
            const ascent = (value: number | undefined) =>
              value === undefined
                ? "—"
                : `${metres(value)}<span class="card-cell-unit"> m</span>`;
            return `<tr data-card-row="${i}" aria-rowindex="${first + localIndex + 2}"><th scope="row"><button class="text-button" data-focus-point="${i}" aria-label="Show point ${offset + i + 1} on map">${offset + i + 1}</button></th><td class="point-name-cell"><input class="point-name" data-point-name="${i}" aria-label="Name for point ${offset + i + 1} (optional)" maxlength="10" placeholder="[Name]" value="${esc(point.name || "")}" ${busy ? "disabled" : ""}></td><td class="grid-reference" title="${esc(coordinate)}"><span class="coordinate-value">${esc(coordinate)}</span></td><td>${ascent(point.ele)}</td><td class="card-extra distance-cell numeric-cell">${km(row.distance)}</td><td class="card-extra">${km(row.total)}</td><td class="card-extra">${ascent(row.ascent)}</td><td class="card-extra">${ascent(row.totalAscent)}</td></tr>`;
          })
          .join("") +
        bottomSpacer
      : `<tr><td colspan="${4}" class="waypoint-empty">${"Confirm Plan in Route Plan to populate this card."}</td></tr>`;
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
            checkpoint();
            started = true;
          }
          const point =
            context!.source.points[offset + Number(input.dataset.pointName)];
          point.name = input.value.slice(0, 10) || undefined;
          points[Number(input.dataset.pointName)].name = point.name;
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
          if (context && (editWelcome || active()?.id !== context.source.id)) {
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
      for (const count of [first, rows.length - end]) {
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
  $<HTMLButtonElement>("create-clear").disabled = busy || !points.length;
  $<HTMLInputElement>("create-name").disabled = busy;
  requestAnimationFrame(updateCardScrollLimit);
}
$("preview-route").onclick = () => {
  if (busy || !workspace.route) return;
  if (cardExpanded) toggleCard();
  if (!previewMode)
    previewReturnInputId = activeInput()?.id ?? workspace.tracks[0]?.id ?? null;
  showAll = false;
  select(workspace.route);
  previewMode = true;
  $("exit-preview").hidden = false;
  $("map-panel").scrollIntoView({ behavior: "smooth", block: "start" });
};
$("exit-preview").onclick = () => {
  if (busy) return;
  const input =
    workspace.tracks.find((track) => track.id === previewReturnInputId) ??
    workspace.tracks[0];
  previewMode = false;
  if (input) select(input);
  else {
    editWelcome = true;
    showAll = true;
    render();
    fitMap();
  }
};
let nameEditStarted = false;
$<HTMLInputElement>("create-name").oninput = (e) => {
  if (busy || !workspace.route) return;
  if (!nameEditStarted) {
    checkpoint();
    nameEditStarted = true;
  }
  const name = (e.target as HTMLInputElement).value.trim() || "Edited Route";
  workspace.route = { ...workspace.route!, name };
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
$("create-save").onclick = () => {
  const context = routeCardContext();
  if (context && context.route.points.length >= 2)
    void exportTrack(context.terrain ?? context.route);
};
$("create-clear").onclick = () => {
  if (busy) return;
  if (!routeCardContext()) return;
  openDialog(
    `${dialogHeader("Clear Edited Route?", "Your input tracks stay in place.")}<p>This clears the joined route, Route Plan and current Edit selection. You can undo this change.</p><div class="dialog-actions"><button class="button secondary" data-close>Cancel</button><button id="confirm-clear-edit" class="button primary">Clear route</button></div>`,
  );
  $("confirm-clear-edit").onclick = () => {
    commit(() => {
      workspace.route = null;
      workspace.routePlan = [];
      workspace.confirmedPlan = [];
      workspace.activeId = null;
      workspace.selection = { start: 0, end: 0 };
      editWelcome = true;
    }, true);
    $<HTMLDialogElement>("dialog").close();
  };
  return;
};
$("dismiss-map").onclick = () => {
  dismissedTileWarning.edit = true;
  $("map-error").hidden = true;
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
      routecardPDF(route, system, terrain, context.offset, fullRouteCard),
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
  renderPointCard();
  requestAnimationFrame(updateCardScrollLimit);
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
    fullRouteCard,
  );
  try {
    if (await shareRoutecard(title, text)) return;
  } catch (error) {
    if (isCancelled(error)) return;
  }
  openDialog(
    `${dialogHeader("Share Route Card")}<p>Copy this Route Card into a message.</p><textarea id="routecard-text" class="text-input routecard-text" aria-label="Route Card text" readonly>${esc(text)}</textarea><div class="dialog-actions"><button class="button secondary" data-close>Done</button><button id="copy-routecard" class="button primary">Copy text</button></div><p id="routecard-copy-status" role="status"></p>`,
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
$("import").onclick = () => importFiles();
$("empty-import").onclick = () => importFiles();
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
  const from = back ? undo : redo,
    to = back ? redo : undo;
  if (!from.length) return;
  to.push(structuredClone(workspace));
  workspace = from.pop()!;
  editWelcome = !workspace.activeId && !workspace.route;
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
      )}</select></section><section class="settings-point-naming"><div class="settings-toggle-row"><h3 id="point-naming-heading">Allow Point Naming</h3><button id="allow-point-naming" class="settings-switch" type="button" role="switch" aria-labelledby="point-naming-heading" aria-describedby="point-naming-description" aria-checked="${allowPointNaming}"><span aria-hidden="true"></span></button></div><p id="point-naming-description">Allow individual points in a route to be named.</p></section><section class="settings-point-naming"><h3>Input Track Editing</h3><p>Set how often editing handles appear. Spacing keeps every input point; simplified copies always use one handle per point. Delete and Trim remove points only from the input. The Edited Route is unchanged.</p><div class="input-handle-options"><label for="settings-handle-interval">Handle every</label><input id="settings-handle-interval" class="text-input" type="number" min="1" max="5000" step="1" inputmode="numeric" value="${inputHandleInterval}"><span>points</span><button id="settings-apply-handles" class="button secondary compact">Apply</button></div><p id="settings-handle-status" class="dialog-note" role="status">Default: 20 points. Endpoints are always included; spacing never removes track points. Fetch Terrain below the Edit map refreshes input heights. Add to Route Plan is below the editing controls; Route Plan is below Input Tracks. Confirm Plan updates the output.</p></section><button class="button primary full" data-close>Done</button>`,
  );
  const handleInterval = $<HTMLInputElement>("settings-handle-interval");
  handleInterval.oninput = () => {
    $<HTMLButtonElement>("settings-apply-handles").disabled =
      !handleInterval.validity.valid || !handleInterval.value;
  };
  $("settings-apply-handles").onclick = async () => {
    if (!handleInterval.reportValidity() || !handleInterval.value) return;
    inputHandleInterval = Number(handleInterval.value);
    selectedInputPoint = null;
    map.resetSelection();
    render();
    try {
      await set(INPUT_HANDLE_KEY, inputHandleInterval);
      $("settings-handle-status").textContent =
        "Handle spacing saved on this device.";
    } catch {
      $("settings-handle-status").textContent =
        "Handle spacing changed for this session, but could not be saved on this device.";
    }
  };
  handleInterval.onkeydown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      $("settings-apply-handles").click();
    }
  };
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
    `${dialogHeader("BareGPS Track Editor", "", true)}${aboutGuide}`,
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
    const savedInterval = await get(INPUT_HANDLE_KEY);
    if (
      Number.isInteger(savedInterval) &&
      savedInterval >= 1 &&
      savedInterval <= MAX_POINTS
    )
      inputHandleInterval = savedInterval;
    const savedCoordinates = await get(COORDINATE_KEY);
    allowPointNaming = (await get(POINT_NAMING_KEY)) === true;
    if (isCoordinateSystem(savedCoordinates))
      coordinateSystem = savedCoordinates;
  } catch {}
  try {
    const saved = await get(STORAGE_KEY);
    if (saved) {
      if (validateWorkspace(saved)) {
        workspace = restoreSeparateWorkspace(saved);
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
