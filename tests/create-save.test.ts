import { it, expect, vi } from "vitest";
import { saveTrack } from "../src/files";
import { exportGPX } from "../src/model";
import { newCreatedRoute, insertWaypoint } from "../src/create";
it("saves a newly created route through the browser GPX download fallback", async () => {
  const route = insertWaypoint(
    insertWaypoint(newCreatedRoute(), 0, { lat: 53.01, lon: -6.33 }),
    1,
    { lat: 53.011, lon: -6.329 },
  );
  route.name = "Wicklow / route";
  let exported: Blob | undefined,
    filename = "",
    href = "";
  const revoke = vi.fn();
  vi.stubGlobal("URL", {
    createObjectURL: (blob: Blob) => {
      exported = blob;
      return "blob:test-route";
    },
    revokeObjectURL: revoke,
  });
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(function (this: HTMLAnchorElement) {
      filename = this.download;
      href = this.href;
    });
  vi.useFakeTimers();
  try {
    expect(await saveTrack(route)).toBe(true);
    expect(filename).toBe("Wicklow  route.gpx");
    expect(href).toBe("blob:test-route");
    expect(exported?.type).toBe("application/gpx+xml");
    expect(exported?.size).toBe(
      new TextEncoder().encode(exportGPX(route)).length,
    );
    await vi.runAllTimersAsync();
    expect(revoke).toHaveBeenCalledWith("blob:test-route");
  } finally {
    click.mockRestore();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});
