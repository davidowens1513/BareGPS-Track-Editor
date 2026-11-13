import L from "leaflet";
import {
  type Point,
  type Track,
  type Selection,
  selectedPoints,
  distance,
} from "./model";
export const HOME_CENTER: L.LatLngTuple = [51.99947, -9.74269];
export const HOME_ZOOM = 13;

export class TrackMap {
  map: L.Map;
  protected layers = L.layerGroup();
  private tileLayer: L.TileLayer;
  private tileFailed = false;
  private failedTiles = new Set<HTMLElement>();
  private initialViewPending = true;
  private editing = false;
  private positionLayers = L.layerGroup();
  showSelectionHandles = true;
  protected endpointLayers: L.Marker[] = [];
  private dragFrame = 0;
  constructor(
    private onSelection: (s: Selection) => void,
    private onTileError: (failed: boolean) => void,
    containerId = "map",
  ) {
    this.map = L.map(containerId, {
      zoomControl: false,
      preferCanvas: true,
      attributionControl: true,
    }).setView(HOME_CENTER, HOME_ZOOM);
    this.tileLayer = L.tileLayer(
      "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 17,
        subdomains: "abc",
        attribution:
          'Map © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · SRTM | <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
      },
    ).addTo(this.map);
    const refreshTileWarning = () => {
      for (const tile of this.failedTiles)
        if (!tile.isConnected) this.failedTiles.delete(tile);
      const failed = this.failedTiles.size > 0;
      if (failed !== this.tileFailed) {
        this.tileFailed = failed;
        this.onTileError(failed);
      }
    };
    this.tileLayer.on("tileerror", (event: L.TileErrorEvent) => {
      if (event.tile.isConnected) this.failedTiles.add(event.tile);
      refreshTileWarning();
    });
    const removeFailedTile = (event: L.TileEvent) => {
      this.failedTiles.delete(event.tile);
      refreshTileWarning();
    };
    this.tileLayer.on("tileload", removeFailedTile);
    this.tileLayer.on("tileunload", removeFailedTile);
    window.addEventListener("online", () => {
      if (this.tileFailed) this.retryTiles();
    });
    this.layers.addTo(this.map);
    this.map.attributionControl.setPosition("bottomright");
    this.map.on("zoomend", () => this.positionHandles());
    L.control
      .scale({ position: "bottomleft", imperial: false })
      .addTo(this.map);
    L.control.zoom({ position: "bottomleft" }).addTo(this.map);
    const container = document.getElementById(containerId)!;
    new ResizeObserver(() => {
      if (container.clientWidth && container.clientHeight) {
        this.map.invalidateSize({ animate: false });
        if (this.initialViewPending) this.home();
      }
    }).observe(container);
  }
  showPosition(point: Point & { accuracy: number }, centre: boolean) {
    this.positionLayers.clearLayers();
    if (!this.map.hasLayer(this.positionLayers))
      this.positionLayers.addTo(this.map);
    const position: L.LatLngTuple = [point.lat, point.lon];
    L.circle(position, {
      radius: point.accuracy,
      color: "#1976d2",
      weight: 1,
      fillOpacity: 0.08,
      interactive: false,
    }).addTo(this.positionLayers);
    L.circleMarker(position, {
      radius: 7,
      color: "white",
      weight: 3,
      fillColor: "#1976d2",
      fillOpacity: 1,
      interactive: false,
    }).addTo(this.positionLayers);
    if (centre) {
      this.initialViewPending = false;
      this.map.invalidateSize({ pan: false });
      this.map.setView(
        position,
        Math.min(17, Math.max(this.map.getZoom(), 15)),
      );
      if (point.accuracy > 300)
        this.map.fitBounds(L.latLng(position).toBounds(point.accuracy * 2), {
          maxZoom: 15,
        });
    }
  }
  home() {
    this.initialViewPending = false;
    this.map.setView(HOME_CENTER, HOME_ZOOM, { animate: false });
  }
  hasTileError() {
    return this.tileFailed;
  }
  retryTiles() {
    this.failedTiles.clear();
    this.tileFailed = false;
    this.onTileError(false);
    this.tileLayer.redraw();
  }
  protected line(
    points: Point[],
    color: string,
    weight = 4,
    opacity = 1,
    target: L.LayerGroup = this.layers,
  ) {
    if (points.length < 2) return;
    // Group runs by gap style rather than creating one Leaflet layer per GPS edge.
    let run: Point[] = [points[0]],
      gap = !!points[1].gapBefore;
    for (let i = 1; i < points.length; i++) {
      const nextGap = !!points[i].gapBefore;
      if (nextGap !== gap) {
        this.stroke(run, color, weight, opacity, gap, target);
        run = [points[i - 1]];
        gap = nextGap;
      }
      run.push(points[i]);
    }
    this.stroke(run, color, weight, opacity, gap, target);
  }
  private stroke(
    points: Point[],
    color: string,
    weight: number,
    opacity: number,
    gap: boolean,
    target: L.LayerGroup = this.layers,
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
    ).addTo(target);
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
    if (!this.showSelectionHandles) return;
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
    this.map.invalidateSize({ pan: false });
    const coords = tracks.flatMap((t) =>
      (selection ? selectedPoints(t, selection) : t.points).map(
        (p) => [p.lat, p.lon] as L.LatLngTuple,
      ),
    );
    if (coords.length) this.initialViewPending = false;
    if (coords.length)
      this.map.fitBounds(L.latLngBounds(coords), {
        padding: [48, 50],
        maxZoom: 16,
        animate: false,
      });
  }
}
