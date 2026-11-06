import "leaflet/dist/leaflet.css";
import "./style.css";
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
import { TrackMap } from "./map";
import { icon } from "./icons";
import { demoTracks } from "./demo";
import { enrichTerrain } from "./terrain";

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
const STORAGE_KEY = "baregps-workspace-v1";

document.querySelector("#app")!.innerHTML = `
<header class="app-header"><a class="brand" href="#" aria-label="BareGPS Track Editor home"><img src="/logo.svg" alt="" width="40" height="40"><strong class="brand-title">BareGPS Track Editor</strong></a><div class="header-right"><span id="save-state" class="save-state" role="status" title="Your workspace is kept on this device. Use Save section or Save route to export a GPX file."><span class="save-full">On your device</span><span class="save-short" aria-hidden="true">On device</span></span><button id="help" class="icon-button" aria-label="Help and keyboard shortcuts">${icon("help")}</button></div></header>
<main>
  <section class="workspace-heading"><div><p class="eyebrow">A LITTLE PLANNING. A GREAT WALK.</p><h1>Your tracks. Your way.</h1></div><div class="heading-actions"><span id="track-count" class="count-label">Your workspace</span><div class="history"><button id="undo" class="icon-button" aria-label="Undo" title="Undo (⌘/Ctrl Z)">${icon("undo", 18)}</button><button id="redo" class="icon-button" aria-label="Redo" title="Redo (⌘/Ctrl Shift Z)">${icon("redo", 18)}</button></div></div></section>
  <section id="map-panel" class="map-panel" aria-label="Track map">
    <div class="map-toolbar"><span class="map-label">${icon("mountain", 18)}<strong>OpenTopoMap</strong><span class="terrain-label">TERRAIN</span></span><div class="map-actions"><button id="view-toggle" class="small-button">${icon("eye", 16)}<span>All tracks</span></button><span class="toolbar-divider"></span><button id="fit" class="icon-button" aria-label="Fit tracks to map" title="Fit tracks">${icon("fit", 18)}</button><button id="expand" class="icon-button" aria-label="Expand map" title="Expand map">${icon("expand", 18)}</button></div></div>
    <div id="map"></div>
    <div id="map-empty" class="map-empty"><span class="empty-icon">${icon("route", 28)}</span><h2>Every good route starts somewhere.</h2><p>Open a GPX file to see your track here.<br>Bring a few, and build something new.</p><button id="empty-import" class="button primary">${icon("plus", 18)}Open GPX files</button><button id="demo" class="text-button">Explore with sample tracks ${icon("chevron", 14)}</button></div>
    <div id="map-error" class="map-error" hidden>Map tiles couldn’t load. Your tracks and editing are still available.<button id="retry-map" class="text-button">Retry</button></div>
    <div class="map-legend" id="map-legend" hidden><span><i class="legend-solid"></i>Recorded track</span><span><i class="legend-dashed"></i>Walking connection</span></div>
  </section>
  <section id="analytics" class="analytics" aria-label="Live track analytics"><div class="metric"><span>${icon("route", 17)} DISTANCE</span><strong id="distance">0.00 <small>km</small></strong></div><div class="metric"><span>${icon("up", 17)} ASCENT</span><strong id="ascent">— <small>m</small></strong></div><div class="metric"><span>${icon("down", 17)} DESCENT</span><strong id="descent">— <small>m</small></strong></div><div class="metric selection-metric"><span>${icon("pin", 17)} SELECTED SECTION</span><strong id="point-count">No track selected</strong><span id="analytics-source" class="metric-note">Open a file to begin</span></div></section>
  <section class="profile-card" aria-label="Elevation profile"><div class="profile-heading"><span>ELEVATION PROFILE</span><span id="profile-range">Select a track to explore its elevation</span></div><div id="profile"></div><div id="elevation-note" class="elevation-note" hidden></div></section>
  <div id="editor" class="editor-grid">
    <section class="card tracks-card"><div class="card-heading"><h2>Your tracks <span id="source-count" class="badge">0</span></h2><button id="import" class="button secondary compact">${icon("plus", 16)}Open files</button></div><div id="track-list" class="track-list"></div><div class="card-footnote"><span>${icon("file", 14)} GPX files · originals stay untouched</span><button id="sample-tracks" class="text-button">Irish samples</button></div></section>
    <section class="card section-card"><div class="card-heading"><h2>Edit a section</h2><span class="badge soft">A → B</span></div><div id="section-controls"></div></section>
  </div>
  <section id="route-card" class="route-card"></section>
  <footer><span><span class="footer-dot"></span> Made for the journey.</span><span>Your files stay on your device. Map & terrain requests use the internet.</span></footer>
</main>
<div id="notice" class="notice" role="status" hidden></div>
<dialog id="dialog"><div id="dialog-content"></div></dialog>
`;
const map = new TrackMap(updateSelection, () => {
  $("map-error").hidden = false;
});
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
  map.render(allTracks(), active(), workspace.selection, showAll);
  $("map-empty").hidden = allTracks().length > 0;
  $("map-legend").hidden = !allTracks().length;
}
function renderStats() {
  const t = active(),
    points = t ? selectedPoints(t, workspace.selection) : [],
    a = analytics(points);
  $("distance").innerHTML = `${km(a.length)} <small>km</small>`;
  const hasElevation = points.some((p) => p.ele !== undefined);
  $("ascent").innerHTML =
    `${hasElevation ? metres(a.ascent) : "—"} <small>m</small>${a.missingEdges || a.estimatedGap ? "<sup>est.</sup>" : ""}`;
  $("descent").innerHTML =
    `${hasElevation ? metres(a.descent) : "—"} <small>m</small>`;
  $("point-count").textContent = t
    ? `${points.length.toLocaleString()} points`
    : "No track selected";
  $("analytics-source").textContent = t
    ? a.gapDistance
      ? `Includes ${km(a.gapDistance)} km of connections`
      : "Selected section · live totals"
    : "Open a file to begin";
  $("profile-range").textContent = hasElevation
    ? `${metres(a.min!)}–${metres(a.max!)} m · ${t!.name}`
    : t
      ? "No elevation data in this section"
      : "Select a track to explore its elevation";
  const note = $("elevation-note");
  note.hidden = !(a.missingEdges || a.estimatedGap);
  note.textContent = a.missingEdges
    ? "Elevation is missing for some points. Ascent and descent are partial; distance includes the entire section."
    : a.estimatedGap
      ? "Connection distance is included. Connection ascent uses endpoint heights until you fetch terrain; intermediate hills may be missed."
      : "";
  const profile = $("profile");
  if (!hasElevation) {
    profile.innerHTML =
      '<div class="profile-empty">' +
      (t
        ? "This GPX has no elevation data. Distance is still available."
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
  <div class="selection-labels"><span><i class="endpoint">A</i> Start <strong id="start-label">Point ${start + 1}</strong></span><span><i class="endpoint">B</i> End <strong id="end-label">Point ${end + 1}</strong></span></div>
  <div class="range-track"><div id="range-fill" style="left:${(start / (t.points.length - 1)) * 100}%;right:${100 - (end / (t.points.length - 1)) * 100}%"></div><input id="range-start" type="range" min="0" max="${t.points.length - 1}" value="${start}" aria-label="Section start point"><input id="range-end" type="range" min="0" max="${t.points.length - 1}" value="${end}" aria-label="Section end point"></div>
  <div class="range-caption"><span id="selected-label">${end - start + 1} of ${t.points.length} points</span><button id="reset-selection" class="text-button">Select whole track</button></div>
  <div class="color-row"><label for="track-color">Track colour</label><div class="swatches">${COLORS.map((c) => `<button class="swatch ${c === t.color ? "chosen" : ""}" data-color="${c}" style="--swatch:${c}" aria-label="Use ${c} track colour" aria-pressed="${c === t.color}"></button>`).join("")}<label class="custom-color" title="Choose custom track colour"><input id="track-color" type="color" value="${t.color}" aria-label="Custom track colour">${icon("plus", 13)}</label></div></div>
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
  box
    .querySelectorAll<HTMLButtonElement>(".swatch")
    .forEach(
      (b) =>
        (b.onclick = () =>
          commit(() => replace({ ...t, color: b.dataset.color! }))),
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
    card.innerHTML = `<span class="route-empty-icon">${icon("join", 26)}</span><div><h2>A few tracks. One adventure.</h2><p>Add selected sections in the order you’ll walk them. We’ll connect the gaps.</p></div><span class="route-step">SELECT <span>→</span> ADD <span>→</span> EXPLORE</span>`;
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
  renderStats();
  renderMap();
  $<HTMLButtonElement>("undo").disabled = !undo.length || busy;
  $<HTMLButtonElement>("redo").disabled = !redo.length || busy;
  $("view-toggle").innerHTML =
    `${icon("eye", 16)}<span>${showAll ? "All tracks" : "Selected section"}</span>`;
  for (const id of [
    "import",
    "empty-import",
    "demo",
    "sample-tracks",
    "view-toggle",
  ])
    $<HTMLButtonElement>(id).disabled = busy;
  document.querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
    if (
      busy &&
      !b.closest("#dialog") &&
      !b.closest("#notice") &&
      !["expand", "help", "retry-map", "fit"].includes(b.id)
    )
      b.disabled = true;
  });
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
function dialogHeader(title: string, subtitle = "") {
  return `<div class="dialog-heading"><div><h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ""}</div><button class="icon-button" data-close aria-label="Close dialog">${icon("close", 20)}</button></div>`;
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
$("sample-tracks").onclick = loadSampleTracks;
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
    map.map.invalidateSize();
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
  persist();
  render();
  fitMap();
}
$("undo").onclick = () => history(true);
$("redo").onclick = () => history(false);
$("help").onclick = () =>
  openDialog(
    `${dialogHeader("A route that’s yours", "A quick guide to BareGPS Track Editor")}<ol class="help-list"><li><strong>Open your files.</strong> Choose one or more GPX tracks or routes from Files. Multiple tracks in one file are supported.</li><li><strong>Choose a section.</strong> Drag A and B on the map or use the sliders. Distance and ascent update as you go.</li><li><strong>Shape your route.</strong> Save the section, split it into two tracks, reverse direction, or add it to a joined route. Add sections in walking order.</li><li><strong>Check connections.</strong> Dashed lines connect separated sections. Their distance and ascent count. Fetch terrain to include hills between endpoints.</li><li><strong>Save to Files.</strong> Save the current section or your complete joined route as GPX. Your originals stay untouched.</li></ol><p class="dialog-note">Undo / redo: ⌘ or Ctrl + Z / Shift + Z. Escape collapses the map. Edits are saved on this device. Ascent sums elevation gains; missing heights are marked as partial. GPX connection markers and track colours round-trip in BareGPS.</p><button class="button primary full" data-close>Let’s go</button>`,
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
