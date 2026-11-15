import type L from "leaflet";

export type MapLayer = "opentopo" | "satellite";
export const isMapLayer = (value: unknown): value is MapLayer =>
  value === "opentopo" || value === "satellite";
export const mapLayers: Record<
  MapLayer,
  {
    name: string;
    badge: string;
    url: string;
    options: L.TileLayerOptions;
    credits: string;
  }
> = {
  opentopo: {
    name: "OpenTopoMap",
    badge: "TERRAIN",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    options: {
      maxZoom: 19,
      maxNativeZoom: 17,
      subdomains: "abc",
      attribution:
        'Map © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · SRTM | <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
    },
    credits:
      'Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a> (ODbL), with SRTM elevation. Map rendering © <a href="https://opentopomap.org" target="_blank" rel="noopener noreferrer">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener noreferrer">CC BY-SA</a>).',
  },
  satellite: {
    name: "Satellite",
    badge: "IMAGERY",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    options: {
      maxZoom: 19,
      maxNativeZoom: 19,
      attribution:
        'Imagery © <a href="https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9">Esri</a>, Vantor, Earthstar Geographics, and the GIS User Community',
    },
    credits:
      'World Imagery © Esri, Vantor, Earthstar Geographics, and the GIS User Community. Satellite includes aerial imagery. <a href="https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9" target="_blank" rel="noopener noreferrer">Imagery sources and terms of use</a>.',
  },
};
