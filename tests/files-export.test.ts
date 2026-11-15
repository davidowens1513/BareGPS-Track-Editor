import { it, expect, vi } from "vitest";
import type { Track } from "../src/model";
const native = vi.hoisted(() => ({
  save: vi.fn(async (_options: any) => ({ saved: true })),
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true },
  registerPlugin: () => native,
}));
import { saveTrack, saveData } from "../src/files";
it("uses the renamed route in both the native filename and GPX contents", async () => {
  const route: Track = {
    id: "route",
    name: "Wicklow loop",
    color: "#16724d",
    kind: "route",
    source: "test",
    points: [
      { lat: 53, lon: -6 },
      { lat: 53.01, lon: -6 },
    ],
  };
  expect(await saveTrack(route)).toBe(true);
  const options = native.save.mock.lastCall![0];
  expect(options.name).toBe("Wicklow loop.gpx");
  expect(atob(options.data)).toContain("<name>Wicklow loop</name>");
  await saveTrack({ ...route, name: "New: walk/route" });
  expect(native.save.mock.lastCall![0].name).toBe("New walkroute.gpx");
});
it("exports backups as JSON files rather than GPX", async () => {
  await saveData("BareGPS-backup.json", '{"version":1}', "application/json");
  expect(native.save.mock.lastCall![0]).toEqual({
    name: "BareGPS-backup.json",
    data: btoa('{"version":1}'),
    mimeType: "application/json",
  });
});
