import { beforeEach, afterEach, it, expect, vi } from "vitest";
import L from "leaflet";
import { TrackMap } from "../src/map";
import { InputMap } from "../src/input-map";
import type { Track } from "../src/model";

let editor: InputMap;
const select = vi.fn();
const selectTrack = vi.fn();
beforeEach(() => {
  document.body.innerHTML = '<div id="map"></div>';
  const container = document.getElementById("map")!;
  Object.defineProperties(container, {
    clientWidth: { value: 800 },
    clientHeight: { value: 600 },
    offsetWidth: { value: 800 },
    offsetHeight: { value: 600 },
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  // Geometry rendering uses canvas; exercise real Leaflet markers, zoom and hit testing here.
  vi.spyOn(
    TrackMap.prototype as unknown as { line: () => void },
    "line",
  ).mockImplementation(() => {});
  select.mockClear();
  selectTrack.mockReset();
  editor = new InputMap(
    () => {},
    () => {},
    {
      insert: vi.fn(),
      move: vi.fn(),
      select,
      selectTrack,
      preview: vi.fn(),
      status: vi.fn(),
    },
  );
  editor.map.setView([53.005, -6], 16, { animate: false });
});
afterEach(() => {
  editor.map.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function render(count = 10001, simplified = false) {
  const track: Track = {
    id: "dense",
    name: "Dense",
    source: "dense.gpx",
    kind: "track",
    color: "#d32f2f",
    simplified,
    points: Array.from({ length: count }, (_, i) => ({
      lat: 53 + (i * 0.01) / (count - 1),
      lon: -6,
    })),
  };
  editor.inputId = track.id;
  editor.pointEditing = true;
  editor.render([track], track, { start: 0, end: count - 1 }, false);
  return track;
}
it("shows only labelled endpoints on import, including a dense simplified input", () => {
  render(10001, true);
  const markers = [...document.querySelectorAll(".input-handle")];
  expect(markers.map((m) => m.textContent)).toEqual(["Start", "Finish"]);
  expect(select).not.toHaveBeenCalled();
});
it("reveals only a local group on tapping the line and clears it on empty map space", () => {
  render();
  editor.map.fire("click", { latlng: L.latLng(53.005, -6) });
  expect(select).toHaveBeenLastCalledWith(expect.any(Number));
  const markers = document.querySelectorAll(".input-handle");
  expect(markers.length).toBeGreaterThan(2);
  expect(markers.length).toBeLessThanOrEqual(9);
  expect(document.querySelectorAll(".input-handle.selected")).toHaveLength(1);
  editor.map.fire("click", { latlng: L.latLng(53.005, -5.99) });
  expect(select).toHaveBeenLastCalledWith(null);
  expect(document.querySelectorAll(".input-handle")).toHaveLength(2);
});
it("keeps a sparse input clean until selected, without discarding geometry", () => {
  const track = render(3);
  expect(document.querySelectorAll(".input-handle")).toHaveLength(2);
  editor.map.fire("click", { latlng: L.latLng(53.005, -6) });
  expect(document.querySelectorAll(".input-handle")).toHaveLength(3);
  expect(track.points).toHaveLength(3);
});

it("draws the other inputs faded and selects a tapped line before revealing its handles", () => {
  const current = render(3);
  const other: Track = {
    ...current,
    id: "other",
    name: "Other",
    color: "#0000ff",
    points: current.points.map((p) => ({ ...p, lon: -5.997 })),
  };
  editor.render([current, other], current, { start: 0, end: 2 }, true);
  expect(TrackMap.prototype["line"]).toHaveBeenCalledWith(
    other.points,
    other.color,
    3,
    0.65,
  );
  selectTrack.mockImplementation((id) => {
    editor.inputId = id;
    editor.render([current, other], other, { start: 0, end: 2 }, true);
  });
  editor.map.fire("click", { latlng: L.latLng(53.005, -5.997) });
  expect(selectTrack).toHaveBeenCalledWith("other");
  expect(select).not.toHaveBeenCalled();
  expect(
    [...document.querySelectorAll(".input-handle")].map((m) => m.textContent),
  ).toEqual(["Start", "Finish"]);
  editor.map.fire("click", { latlng: L.latLng(53.005, -5.997) });
  expect(select).toHaveBeenCalledWith(1);
  expect(document.querySelectorAll(".input-handle")).toHaveLength(3);
});

it("keeps the current input at an overlap and cannot select hidden tracks", () => {
  const current = render(3);
  const coincident = { ...current, id: "coincident", name: "Coincident" };
  editor.render([current, coincident], current, { start: 0, end: 2 }, true);
  editor.map.fire("click", { latlng: L.latLng(53.005, -6) });
  expect(selectTrack).not.toHaveBeenCalled();
  expect(select).toHaveBeenCalledWith(1);
  const other = {
    ...current,
    id: "other",
    points: current.points.map((p) => ({ ...p, lon: -5.997 })),
  };
  editor.resetSelection();
  editor.render([current, other], current, { start: 0, end: 2 }, false);
  editor.map.fire("click", { latlng: L.latLng(53.005, -5.997) });
  expect(selectTrack).not.toHaveBeenCalled();
});
