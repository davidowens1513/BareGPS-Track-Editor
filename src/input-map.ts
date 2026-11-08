import L from "leaflet";
import { TrackMap } from "./map";
import { isClosedRoute } from "./create";
import {
  inputHandleIndices,
  MAX_VISIBLE_INPUT_HANDLES,
  reshapeInputHandle,
  type InputPointTool,
} from "./input-edit";
import type { Point, Selection, Track } from "./model";

type InputCallbacks = {
  insert: (index: number, point: Point) => void;
  move: (index: number, point: Point, handles: number[]) => void;
  select: (index: number) => void;
  preview: (track: Track) => void;
  status: (visible: number, total: number) => void;
};

export class InputMap extends TrackMap {
  inputId: string | null = null;
  pointEditing = false;
  enabled = true;
  tool: InputPointTool = "move";
  interval = 20;
  selectedIndex: number | null = null;
  readonly extraHandles = new Set<number>();
  private current: Track | null = null;
  private inputLines = L.layerGroup();
  private dragging = false;
  private previewFrame = 0;
  private ignoreClickUntil = 0;
  private lastRender?: [Track[], Track | null, Selection, boolean];

  constructor(
    onSelection: (selection: Selection) => void,
    onTileError: (failed: boolean) => void,
    private callbacks: InputCallbacks,
  ) {
    super(onSelection, onTileError);
    this.showSelectionHandles = false;
    this.map.on("click", (event: L.LeafletMouseEvent) => {
      if (
        !this.pointEditing ||
        !this.enabled ||
        !this.current ||
        this.dragging ||
        Date.now() < this.ignoreClickUntil
      )
        return;
      const point = { lat: event.latlng.lat, lon: event.latlng.wrap().lng };
      if (this.tool === "add") {
        this.callbacks.insert(this.current.points.length, point);
        return;
      }
      const segment = this.closestSegment(event.latlng);
      if (!segment) return;
      if (this.tool === "insert") this.callbacks.insert(segment.end, point);
      else {
        this.selectedIndex = segment.closestPoint;
        this.extraHandles.add(segment.closestPoint);
        this.callbacks.select(segment.closestPoint);
        this.redraw();
      }
    });
    this.map.on("moveend zoomend", () => {
      if (this.pointEditing && !this.dragging) this.redraw();
    });
  }
  resetSelection() {
    this.selectedIndex = null;
    this.extraHandles.clear();
  }
  private redraw() {
    if (this.lastRender) this.render(...this.lastRender);
  }
  override render(
    tracks: Track[],
    active: Track | null,
    selection: Selection,
    showAll: boolean,
  ) {
    this.lastRender = [tracks, active, selection, showAll];
    if (!this.pointEditing || !active || active.id !== this.inputId) {
      this.current = null;
      super.render(tracks, active, selection, showAll);
      return;
    }
    if (this.dragging) return;
    this.current = active;
    this.layers.clearLayers();
    this.endpointLayers = [];
    this.inputLines.clearLayers();
    this.inputLines.addTo(this.layers);
    if (showAll)
      for (const track of tracks)
        if (track.id !== active.id)
          this.line(track.points, track.color, 3, 0.35);
    this.line(active.points, active.color, 4, 1, this.inputLines);
    const extras = [
      ...this.extraHandles,
      ...(this.selectedIndex === null ? [] : [this.selectedIndex]),
    ];
    const handles = inputHandleIndices(active, this.interval, extras);
    const bounds = this.map.getBounds().pad(0.1);
    const nearby = handles.filter((i) =>
      bounds.contains([active.points[i].lat, active.points[i].lon]),
    );
    const stride = Math.max(
      1,
      Math.ceil(nearby.length / (MAX_VISIBLE_INPUT_HANDLES - 3)),
    );
    const visible = new Set(nearby.filter((_, i) => i % stride === 0));
    visible.add(0);
    visible.add(active.points.length - 1);
    if (this.selectedIndex !== null && active.points[this.selectedIndex])
      visible.add(this.selectedIndex);
    this.callbacks.status(visible.size, handles.length);
    const closed = isClosedRoute(active);
    const markers = new Map<number, L.Marker>();
    for (const index of visible) {
      const point = active.points[index];
      const offset = closed
        ? index === 0
          ? -19
          : index === active.points.length - 1
            ? 19
            : 0
        : 0;
      const marker = L.marker([point.lat, point.lon], {
        draggable: this.enabled,
        autoPan: true,
        bubblingMouseEvents: false,
        keyboard: true,
        title: `Input point ${index + 1} · drag to reshape`,
        icon: L.divIcon({
          className: `track-handle input-handle${this.selectedIndex === index ? " selected" : ""}`,
          html: `<span style="--input-colour:${active.color}">${index + 1}</span>`,
          iconSize: [32, 40],
          iconAnchor: [16 - offset, 36],
        }),
      }).addTo(this.layers);
      markers.set(index, marker);
      marker.on("click", () => {
        this.selectedIndex = index;
        this.callbacks.select(index);
        this.redraw();
      });
      marker.on("dragstart", () => {
        this.dragging = true;
        this.selectedIndex = index;
        this.callbacks.select(index);
      });
      const preview = () => {
        const position = marker.getLatLng();
        try {
          const changed = reshapeInputHandle(
            active,
            index,
            { lat: position.lat, lon: position.wrap().lng },
            handles,
          );
          this.inputLines.clearLayers();
          // Keep live dragging responsive; the complete geometry is restored on drop.
          const step = Math.max(1, Math.ceil(changed.points.length / 5000));
          const display = changed.points.filter(
            (p, i) =>
              i % step === 0 ||
              i === index ||
              i === changed.points.length - 1 ||
              !!p.gapBefore !== !!changed.points[i + 1]?.gapBefore ||
              !!p.gapBefore !== !!changed.points[i - 1]?.gapBefore,
          );
          this.line(display, active.color, 4, 1, this.inputLines);
          if (closed && (index === 0 || index === active.points.length - 1))
            markers
              .get(index === 0 ? active.points.length - 1 : 0)
              ?.setLatLng(position);
          this.callbacks.preview(changed);
        } catch {
          /* Invalid previews are rejected with a message on drop. */
        }
      };
      marker.on("drag", () => {
        cancelAnimationFrame(this.previewFrame);
        this.previewFrame = requestAnimationFrame(preview);
      });
      marker.on("dragend", () => {
        cancelAnimationFrame(this.previewFrame);
        this.dragging = false;
        this.ignoreClickUntil = Date.now() + 250;
        const point = marker.getLatLng();
        this.callbacks.move(
          index,
          { lat: point.lat, lon: point.wrap().lng },
          handles,
        );
        this.redraw();
      });
    }
  }
  private closestSegment(
    position: L.LatLng,
  ): { end: number; closestPoint: number } | null {
    if (!this.current) return null;
    const click = this.map.latLngToLayerPoint(position),
      radius = 24;
    const southWest = this.map.layerPointToLatLng(
      click.subtract([radius, -radius]),
    );
    const northEast = this.map.layerPointToLatLng(click.add([radius, -radius]));
    let best = radius,
      result: { end: number; closestPoint: number } | null = null;
    for (let i = 1; i < this.current.points.length; i++) {
      const a = this.current.points[i - 1],
        b = this.current.points[i];
      if (
        Math.max(a.lat, b.lat) < southWest.lat ||
        Math.min(a.lat, b.lat) > northEast.lat ||
        Math.max(a.lon, b.lon) < southWest.lng ||
        Math.min(a.lon, b.lon) > northEast.lng
      )
        continue;
      const from = this.map.latLngToLayerPoint([a.lat, a.lon]),
        to = this.map.latLngToLayerPoint([b.lat, b.lon]);
      const distance = L.LineUtil.pointToSegmentDistance(click, from, to);
      if (distance <= best) {
        best = distance;
        result = {
          end: i,
          closestPoint:
            click.distanceTo(from) < click.distanceTo(to) ? i - 1 : i,
        };
      }
    }
    return result;
  }
}
