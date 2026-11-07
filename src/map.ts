import L from "leaflet";
import {
  type Point,
  type Track,
  type Selection,
  selectedPoints,
  distance,
} from "./model";
export class TrackMap {
  map: L.Map;
  protected layers = L.layerGroup();
  private tileLayer: L.TileLayer;
  private tileFailed = false;
  private editing = false;
  private endpointLayers: L.Marker[] = [];
  private dragFrame = 0;
  constructor(
    private onSelection: (s: Selection) => void,
    onTileError: () => void,
    containerId = "map",
  ) {
    this.map = L.map(containerId, {
      zoomControl: false,
      preferCanvas: true,
      attributionControl: true,
    }).setView([53.4, -8.0], 7);
    this.tileLayer = L.tileLayer(
      "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 17,
        subdomains: "abc",
        attribution:
          'Map © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · SRTM | <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
      },
    ).addTo(this.map);
    this.tileLayer.on("tileerror", () => {
      if (!this.tileFailed) {
        this.tileFailed = true;
        onTileError();
      }
    });
    this.layers.addTo(this.map);
    this.map.on("zoomend", () => this.positionHandles());
    L.control.zoom({ position: "bottomright" }).addTo(this.map);
    L.control
      .scale({ position: "bottomleft", imperial: false })
      .addTo(this.map);
    const container = document.getElementById(containerId)!;
    new ResizeObserver(() => {
      if (container.clientWidth && container.clientHeight)
        this.map.invalidateSize({ pan: false });
    }).observe(container);
  }
  hasTileError() {
    return this.tileFailed;
  }
  retryTiles() {
    this.tileFailed = false;
    this.tileLayer.redraw();
  }
  private line(points: Point[], color: string, weight = 4, opacity = 1) {
    if (points.length < 2) return;
    // Group runs by gap style rather than creating one Leaflet layer per GPS edge.
    let run: Point[] = [points[0]],
      gap = !!points[1].gapBefore;
    for (let i = 1; i < points.length; i++) {
      const nextGap = !!points[i].gapBefore;
      if (nextGap !== gap) {
        this.stroke(run, color, weight, opacity, gap);
        run = [points[i - 1]];
        gap = nextGap;
      }
      run.push(points[i]);
    }
    this.stroke(run, color, weight, opacity, gap);
  }
  private stroke(
    points: Point[],
    color: string,
    weight: number,
    opacity: number,
    gap: boolean,
  ) {
    L.polyline(
      points.map((p) => [p.lat, p.lon] as L.LatLngTuple),
      {
        color,
        weight,
        opacity,
        dashArray: gap ? "7 8" : undefined,
        lineCap: "round",
      },
    ).addTo(this.layers);
  }
  render(
    tracks: Track[],
    active: Track | null,
    selection: Selection,
    showAll: boolean,
  ) {
    if (this.editing) return;
    this.layers.clearLayers();
    this.endpointLayers = [];
    if (showAll)
      for (const track of tracks)
        if (track.id !== active?.id)
          this.line(track.points, track.color, 3, 0.55);
    if (!active) return;
    this.line(active.points, "#53685a", 3, 0.25);
    const part = selectedPoints(active, selection);
    this.line(part, active.color, 5);
    (
      [
        ["start", selection.start, "A"],
        ["end", selection.end, "B"],
      ] as const
    ).forEach(([key, index, label]) => {
      const point = active.points[index];
      if (!point) return;
      const marker = L.marker([point.lat, point.lon], {
        draggable: true,
        autoPan: true,
        icon: this.handleIcon(label, 0),
        title: `Drag ${key} of selected section`,
        keyboard: true,
      }).addTo(this.layers);
      let current = { ...selection };
      const update = () => {
        const pos = marker.getLatLng();
        const from = key === "start" ? 0 : current.start + 1,
          to = key === "start" ? current.end - 1 : active.points.length - 1;
        let closest = from,
          best = Infinity;
        for (let i = from; i <= to; i++) {
          const d = distance({ lat: pos.lat, lon: pos.lng }, active.points[i]);
          if (d < best) {
            best = d;
            closest = i;
          }
        }
        current = { ...current, [key]: closest };
        this.onSelection(current);
      };
      marker.on("dragstart", () => {
        this.editing = true;
      });
      marker.on("drag", () => {
        cancelAnimationFrame(this.dragFrame);
        this.dragFrame = requestAnimationFrame(update);
      });
      marker.on("dragend", () => {
        cancelAnimationFrame(this.dragFrame);
        update();
        this.editing = false;
        this.onSelection(current);
      });
      this.endpointLayers.push(marker);
    });
    this.positionHandles();
  }
  protected handleIcon(label: string, offset: number) {
    return L.divIcon({
      className: "track-handle",
      html: `<span>${label}</span>`,
      iconSize: [32, 40],
      iconAnchor: [16 - offset, 36],
    });
  }
  private positionHandles() {
    if (this.editing || this.endpointLayers.length !== 2) return;
    const [a, b] = this.endpointLayers;
    const overlap =
      this.map
        .latLngToLayerPoint(a.getLatLng())
        .distanceTo(this.map.latLngToLayerPoint(b.getLatLng())) < 38;
    // Closed loops share one coordinate; keep both A and B reachable.
    a.setIcon(this.handleIcon("A", overlap ? -19 : 0));
    b.setIcon(this.handleIcon("B", overlap ? 19 : 0));
  }
  fit(tracks: Track[], selection?: Selection) {
    const coords = tracks.flatMap((t) =>
      (selection ? selectedPoints(t, selection) : t.points).map(
        (p) => [p.lat, p.lon] as L.LatLngTuple,
      ),
    );
    if (coords.length)
      this.map.fitBounds(L.latLngBounds(coords), {
        padding: [48, 50],
        maxZoom: 16,
        animate: false,
      });
  }
}

import { routeTapIndex, isClosedRoute, type DrawingMode } from "./create";

export class CreateMap extends TrackMap {
  drawingMode: DrawingMode = "add";
  enabled = true;
  private draggingPoint = false;
  private current: Track | null = null;
  private segments: L.Polyline[] = [];
  constructor(
    private onAdd: (index: number, point: Point) => void,
    private onMove: (index: number, point: Point) => void,
    private onPreview: (index: number, point: Point) => void,
    onTileError: () => void,
  ) {
    super(() => {}, onTileError, "create-map");
    this.map.doubleClickZoom.disable();
    this.map.on("click", (event: L.LeafletMouseEvent) => {
      if (this.enabled && !this.draggingPoint && this.current) {
        const index = routeTapIndex(
          this.drawingMode,
          this.current.points.length,
        );
        if (index !== null) this.onAdd(index, this.coordinate(event.latlng));
      }
    });
  }
  private coordinate(pos: L.LatLng): Point {
    return { lat: pos.lat, lon: pos.wrap().lng };
  }
  renderCreated(route: Track) {
    if (this.draggingPoint) return;
    this.current = route;
    this.layers.clearLayers();
    this.segments = [];
    route.points.forEach((point, index) => {
      if (!index) return;
      const previous = route.points[index - 1];
      const coords: L.LatLngTuple[] = [
        [previous.lat, previous.lon],
        [point.lat, point.lon],
      ];
      const options = {
        bubblingMouseEvents: false,
        interactive: this.drawingMode === "insert",
      };
      const hit = L.polyline(coords, {
        ...options,
        weight: 24,
        opacity: 0,
        className: "create-segment-hit",
      }).addTo(this.layers);
      const line = L.polyline(coords, {
        ...options,
        weight: 4,
        color: route.color,
        className: "create-segment",
      }).addTo(this.layers);
      const insert = (event: L.LeafletMouseEvent) => {
        const target = routeTapIndex(
          this.drawingMode,
          route.points.length,
          index,
        );
        if (this.enabled && target !== null)
          this.onAdd(target, this.coordinate(event.latlng));
      };
      hit.on("click", insert);
      line.on("click", insert);
      this.segments.push(hit, line);
    });
    route.points.forEach((point, index) => {
      const marker = L.marker([point.lat, point.lon], {
        draggable: this.enabled,
        autoPan: true,
        bubblingMouseEvents: false,
        icon: this.handleIcon(
          String(index + 1),
          isClosedRoute(route)
            ? index === 0
              ? -19
              : index === route.points.length - 1
                ? 19
                : 0
            : 0,
        ),
        title: `Route point ${index + 1} · drag to move`,
        keyboard: true,
      }).addTo(this.layers);
      marker.on("dragstart", () => {
        this.draggingPoint = true;
      });
      marker.on("drag", () => {
        const pos = marker.getLatLng();
        const preview = route.points.map((p, i) =>
          i === index ? this.coordinate(pos) : p,
        );
        this.segments.forEach((segment, i) => {
          const end = Math.floor(i / 2) + 1;
          segment.setLatLngs([
            [preview[end - 1].lat, preview[end - 1].lon],
            [preview[end].lat, preview[end].lon],
          ]);
        });
        this.onPreview(index, this.coordinate(pos));
      });
      marker.on("dragend", () => {
        this.draggingPoint = false;
        this.onMove(index, this.coordinate(marker.getLatLng()));
      });
    });
  }
}
