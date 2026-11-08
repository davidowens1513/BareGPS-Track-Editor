import { needsTerrain } from "./input-edit";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { type Track } from "./model";
import {
  coordinateSystems,
  formatCoordinate,
  type CoordinateSystem,
} from "./coordinates";
import { routecardRows } from "./routecard";

export function routecardPDF(
  route: Track,
  system: CoordinateSystem,
  terrain?: Track,
  pointOffset = 0,
): Blob {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const km = (n: number) => (n / 1000).toFixed(2);
  const height = (n: number | undefined) =>
    n === undefined ? "Unavailable" : String(Math.round(n));
  doc.setTextColor(22, 103, 71);
  doc.setFontSize(19);
  doc.text("BareGPS Route Card", 14, 17);
  doc.setFontSize(12);
  const title = doc.splitTextToSize(route.name, 267);
  doc.text(title, 14, 25);
  const top = 29 + title.length * 5;
  doc.setFontSize(9);
  doc.setTextColor(70);
  doc.text(`Coordinates: ${coordinateSystems[system]}`, 14, top);
  autoTable(doc, {
    startY: top + 5,
    margin: { top: 14, bottom: 20, left: 14, right: 14 },
    head: [
      [
        "Point",
        "Name",
        "Grid reference",
        "Height\n(m)",
        "Distance\n(km)",
        "Cumul Distance\n(km)",
        "Ascent\n(m)",
        "Cumul Ascent\n(m)",
      ],
    ],
    body: routecardRows(route, terrain).map((r, i) => [
      String(i + 1 + pointOffset),
      r.point.name || "",
      formatCoordinate(r.point, system),
      height(r.point.ele),
      km(r.distance),
      km(r.total),
      height(r.ascent),
      height(r.totalAscent),
    ]),
    styles: {
      fontSize: 9,
      cellPadding: 3,
      overflow: "linebreak",
      lineWidth: 0.2,
      lineColor: [143, 162, 130],
      halign: "left",
    },
    headStyles: { fillColor: [22, 103, 71], halign: "center" },
    alternateRowStyles: { fillColor: [245, 248, 240] },
    columnStyles: {
      0: { cellWidth: 16, halign: "right" },
      1: { cellWidth: 29 },
      2: { cellWidth: 53 },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
    },
    rowPageBreak: "avoid",
    didDrawPage: () => {
      doc.setFontSize(8);
      doc.setTextColor(90);
      doc.text(
        needsTerrain(terrain ?? route)
          ? "Terrain incomplete: heights and ascent are partial. Distances join points by straight lines."
          : "Straight-line distances; heights and ascent are estimates. Unavailable means missing elevation data.",
        14,
        198,
      );
      doc.text(
        `BareGPS Route Planner | Page ${doc.getNumberOfPages()}`,
        14,
        203,
      );
    },
  });
  return doc.output("blob");
}
