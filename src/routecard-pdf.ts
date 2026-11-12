import { needsTerrain } from "./terrain-state";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { type Track } from "./model";
import {
  coordinateSystems,
  formatCoordinate,
  type CoordinateSystem,
} from "./coordinates";
import { routecardRows, ROUTE_CARD_FOOTER } from "./routecard";

export function routecardPDF(
  route: Track,
  system: CoordinateSystem,
  terrain?: Track,
  pointOffset = 0,
  full = false,
  showPointNames = false,
): Blob {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const km = (n: number) => (n / 1000).toFixed(2);
  const height = (n: number | undefined) =>
    n === undefined ? "Unavailable" : String(Math.round(n));
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const tableWidth = pageWidth - margin * 2;
  doc.setTextColor(22, 103, 71);
  doc.setFontSize(19);
  doc.text("BareGPS Route Card", margin, 17);
  doc.setFontSize(12);
  const title = doc.splitTextToSize(route.name, tableWidth);
  doc.text(title, margin, 25);
  const top = 29 + title.length * 5;
  doc.setFontSize(9);
  doc.setTextColor(70);
  doc.text(`Coordinates: ${coordinateSystems[system]}`, margin, top);
  const rows = routecardRows(route, terrain, full);
  doc.text(
    `${rows.length} checkpoints from ${route.points.length} route points`,
    margin,
    top + 5,
  );
  const incomplete = needsTerrain(terrain ?? route);
  if (incomplete)
    doc.text(
      "Terrain incomplete — heights and ascent are partial.",
      margin,
      top + 10,
    );
  const gridIndex = showPointNames ? 2 : 1;
  const heightIndex = gridIndex + 1;
  const metricStart = heightIndex + 1;
  const metricWidth = 23;
  const columnStyles: Record<
    number,
    { cellWidth: number; halign?: "left" | "right" }
  > = {
    0: { cellWidth: 12, halign: "right" },
    [gridIndex]: {
      cellWidth:
        tableWidth - 12 - 22 - 4 * metricWidth - (showPointNames ? 24 : 0),
    },
    [heightIndex]: { cellWidth: 22, halign: "right" },
  };
  if (showPointNames) columnStyles[1] = { cellWidth: 24 };
  for (let i = 0; i < 4; i++)
    columnStyles[metricStart + i] = { cellWidth: metricWidth, halign: "right" };
  autoTable(doc, {
    startY: top + (incomplete ? 16 : 10),
    margin: { top: 14, bottom: 26, left: margin, right: margin },
    tableWidth,
    head: [
      [
        "Point",
        ...(showPointNames ? ["Name"] : []),
        "Grid reference",
        "Height\n(m)",
        "Distance\n(km)",
        "Cumul\nDistance\n(km)",
        "Ascent\n(m)",
        "Cumul\nAscent\n(m)",
      ],
    ],
    body: rows.map((r) => [
      String(r.index + 1 + pointOffset),
      ...(showPointNames ? [r.point.name || ""] : []),
      formatCoordinate(r.point, system),
      height(r.point.ele),
      km(r.distance),
      km(r.total),
      height(r.ascent),
      height(r.totalAscent),
    ]),
    styles: {
      fontSize: 8.5,
      cellPadding: 2,
      overflow: "linebreak",
      lineWidth: 0.2,
      lineColor: [143, 162, 130],
      halign: "left",
    },
    headStyles: {
      fillColor: [22, 103, 71],
      halign: "center",
      valign: "middle",
    },
    alternateRowStyles: { fillColor: [245, 248, 240] },
    columnStyles,
    rowPageBreak: "avoid",
    didDrawPage: () => {
      doc.setFontSize(8);
      doc.setTextColor(90);
      ROUTE_CARD_FOOTER.forEach((line, i) => {
        doc.text(line, margin, pageHeight - 16.2 + i * 3.6);
      });
      doc.text(
        `Page ${doc.getNumberOfPages()}`,
        pageWidth - margin,
        pageHeight - 9,
        { align: "right" },
      );
    },
  });
  return doc.output("blob");
}
