import proj4 from "proj4";
import { forward } from "mgrs";
import type { Point } from "./model";

export const coordinateSystems = {
  latlon: "Lat/Long (WGS84)",
  irish: "Irish National Grid",
  british: "British National Grid",
  itm: "Irish Transverse Mercator (ITM)",
  mgrs: "MGRS (WGS84)",
  utm: "UTM (WGS84)",
  usng: "USNG (WGS84)",
} as const;
export type CoordinateSystem = keyof typeof coordinateSystems;
export const isCoordinateSystem = (value: unknown): value is CoordinateSystem =>
  typeof value === "string" && Object.hasOwn(coordinateSystems, value);

// EPSG:29903/2157 definitions; OSGB36 uses OS's approximate Helmert
// transformation rather than the survey-grade OSTN15 correction grid.
proj4.defs(
  "IRISH",
  "+proj=tmerc +lat_0=53.5 +lon_0=-8 +k=1.000035 +x_0=200000 +y_0=250000 +a=6377340.189 +rf=299.3249646 +towgs84=482.5,-130.6,564.6,-1.042,-0.214,-0.631,8.15 +units=m",
);
proj4.defs(
  "ITM",
  "+proj=tmerc +lat_0=53.5 +lon_0=-8 +k=0.99982 +x_0=600000 +y_0=750000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m",
);
proj4.defs(
  "BRITISH",
  "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=446.448,-125.157,542.060,0.1502,0.2470,0.8421,-20.4894 +units=m",
);
const letters = "ABCDEFGHJKLMNOPQRSTUVWXYZ";
const digits = (n: number) =>
  Math.floor(n % 100000)
    .toString()
    .padStart(5, "0");
const inIreland = ({ lat, lon }: Point) =>
  lat >= 51.2 && lat <= 55.8 && lon >= -11.1 && lon <= -5.2;
const inBritain = ({ lat, lon }: Point) =>
  lat >= 49.8 && lat <= 61 && lon >= -9 && lon <= 2;
export function formatCoordinate(
  point: Point,
  system: CoordinateSystem,
): string {
  const { lat, lon } = point;
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    Math.abs(lat) > 90 ||
    Math.abs(lon) > 180
  )
    return "Invalid coordinates";
  if (system === "latlon") return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  if ((system === "irish" || system === "itm") && !inIreland(point))
    return "Outside Irish grid coverage";
  if (system === "british" && !inBritain(point))
    return "Outside British grid coverage";
  try {
    if (system === "irish" || system === "british" || system === "itm") {
      const [e, n] = proj4(
        "EPSG:4326",
        system === "irish" ? "IRISH" : system === "british" ? "BRITISH" : "ITM",
        [lon, lat],
      );
      if (!Number.isFinite(e) || !Number.isFinite(n))
        return "Coordinates unavailable";
      if (system === "itm") return `E ${Math.round(e)} · N ${Math.round(n)}`;
      const x = Math.floor(e / 100000),
        y = Math.floor(n / 100000);
      if (system === "irish") {
        if (x < 0 || x > 4 || y < 0 || y > 4)
          return "Outside Irish grid coverage";
        return `${letters[(4 - y) * 5 + x]} ${digits(e)} ${digits(n)}`;
      }
      if (x < 0 || x > 6 || y < 0 || y > 12)
        return "Outside British grid coverage";
      const first = 19 - y - ((19 - y) % 5) + Math.floor((x + 10) / 5);
      const second = (((19 - y) * 5) % 25) + (x % 5);
      return `${letters[first]}${letters[second]} ${digits(e)} ${digits(n)}`;
    }
    if (lat < -80 || lat > 84)
      return `Outside ${system.toUpperCase()} coverage (80°S–84°N)`;
    const reference = forward([lon, lat], 5);
    if (system === "mgrs" || system === "usng")
      return reference.replace(
        /^(\d{1,2}[A-Z])([A-Z]{2})(\d{5})(\d{5})$/,
        "$1 $2 $3 $4",
      );
    // The MGRS library selects the correct zone, including Norway/Svalbard.
    const zone = Number(reference.match(/^\d+/)![0]);
    const [e, n] = proj4(
      "EPSG:4326",
      `+proj=utm +zone=${zone} ${lat < 0 ? "+south" : ""} +datum=WGS84 +units=m`,
      [lon, lat],
    );
    return `${zone}${lat < 0 ? "S" : "N"} · E ${Math.round(e)} · N ${Math.round(n)}`;
  } catch {
    return "Coordinates unavailable";
  }
}
