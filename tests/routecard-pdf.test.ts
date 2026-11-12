import { afterEach, it, expect, vi } from "vitest";
import { Blob as NodeBlob } from "node:buffer";
import autoTable from "jspdf-autotable";
import { routecardPDF } from "../src/routecard-pdf";
import { ROUTE_CARD_FOOTER, routecardText } from "../src/routecard";
import type { Track } from "../src/model";
vi.mock("jspdf-autotable", () => ({ default: vi.fn() }));
const route: Track = {
  id: "pdf",
  name: "PDF circuit",
  source: "test",
  kind: "track",
  color: "#ff0000",
  points: Array.from({ length: 90 }, (_, i) => ({
    lat: 53 + i * 0.001,
    lon: -6,
    ele: 100 + i,
    ...(i % 10 === 0 ? { name: "Gate " + i } : {}),
  })),
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it.each([false, true])(
  "uses portrait A4 and equal metric columns with point naming %s",
  async (names) => {
    vi.stubGlobal("Blob", NodeBlob);
    const blob = routecardPDF(route, "latlon", undefined, 0, false, names);
    const pdf = await blob.text();
    const match = pdf.match(/\/MediaBox \[([\d. ]+)\]/)!;
    const box = match[1].trim().split(/\s+/).map(Number);
    expect(box[2]).toBeCloseTo(595.28, 1);
    expect(box[3]).toBeCloseTo(841.89, 1);
    const [document, table] = vi.mocked(autoTable).mock.calls[0] as any;
    expect(table.head[0].includes("Name")).toBe(names);
    const firstMetric = names ? 4 : 3;
    const widths = Array.from(
      { length: 4 },
      (_, i) => table.columnStyles[firstMetric + i].cellWidth,
    );
    expect(new Set(widths).size).toBe(1);
    expect(table.body).toHaveLength(30);
    expect(
      table.body.every((r: unknown[]) => r.length === (names ? 8 : 7)),
    ).toBe(true);
    const text = vi.spyOn(document, "text");
    table.didDrawPage();
    for (const line of ROUTE_CARD_FOOTER) {
      expect(text.mock.calls.some((args) => args[0] === line)).toBe(true);
      expect(routecardText(route, "latlon")).toContain(line);
    }
  },
);
it("retains full-card export independently of the optional Name column", () => {
  routecardPDF(route, "latlon", undefined, 0, true, false);
  const [, table] = vi.mocked(autoTable).mock.calls[0] as any;
  expect(table.body).toHaveLength(90);
  expect(table.head[0]).not.toContain("Name");
});
