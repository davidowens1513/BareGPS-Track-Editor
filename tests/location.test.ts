import { beforeEach, describe, expect, it, vi } from "vitest";
const platform = vi.hoisted(() => ({ native: false }));
const api = vi.hoisted(() => ({
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
  getCurrentPosition: vi.fn(),
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => platform.native },
}));
vi.mock("@capacitor/geolocation", () => ({ Geolocation: api }));
import { getDevicePosition, locationError } from "../src/location";
beforeEach(() => {
  vi.resetAllMocks();
  platform.native = false;
  api.getCurrentPosition.mockResolvedValue({
    coords: { latitude: 51.99947, longitude: -9.74269, accuracy: 15 },
  });
});
describe("one-shot current position", () => {
  it("uses the browser location request without calling native permission APIs", async () => {
    expect(await getDevicePosition()).toEqual({
      lat: 51.99947,
      lon: -9.74269,
      accuracy: 15,
    });
    expect(api.checkPermissions).not.toHaveBeenCalled();
    expect(api.requestPermissions).not.toHaveBeenCalled();
    expect(api.getCurrentPosition).toHaveBeenCalledWith({
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  });
  it("requests native permission when needed", async () => {
    platform.native = true;
    api.checkPermissions.mockResolvedValue({
      location: "prompt",
      coarseLocation: "prompt",
    });
    api.requestPermissions.mockResolvedValue({
      location: "granted",
      coarseLocation: "granted",
    });
    await getDevicePosition();
    expect(api.requestPermissions).toHaveBeenCalledWith({
      permissions: ["location"],
    });
  });
  it("accepts Android approximate permission", async () => {
    platform.native = true;
    api.checkPermissions.mockResolvedValue({
      location: "denied",
      coarseLocation: "granted",
    });
    await getDevicePosition();
    expect(api.requestPermissions).not.toHaveBeenCalled();
  });
  it("does not obtain coordinates after permission is denied", async () => {
    platform.native = true;
    api.checkPermissions.mockResolvedValue({
      location: "prompt",
      coarseLocation: "prompt",
    });
    api.requestPermissions.mockResolvedValue({
      location: "denied",
      coarseLocation: "denied",
    });
    await expect(getDevicePosition()).rejects.toEqual({
      code: "OS-PLUG-GLOC-0003",
    });
    expect(api.getCurrentPosition).not.toHaveBeenCalled();
  });
  it("rejects corrupt fixes rather than moving the map", async () => {
    for (const coords of [
      { latitude: NaN, longitude: 0, accuracy: 1 },
      { latitude: 91, longitude: 0, accuracy: 1 },
      { latitude: 0, longitude: 181, accuracy: 1 },
      { latitude: 0, longitude: 0, accuracy: -1 },
    ]) {
      api.getCurrentPosition.mockResolvedValue({ coords });
      await expect(getDevicePosition()).rejects.toThrow("Invalid position");
    }
  });
  it("explains denied access, disabled services, timeout and unavailable fixes", () => {
    for (const code of [1, "OS-PLUG-GLOC-0003"])
      expect(locationError({ code })).toContain("denied");
    expect(locationError({ code: "OS-PLUG-GLOC-0007" })).toContain("off");
    for (const code of [3, "OS-PLUG-GLOC-0010"])
      expect(locationError({ code })).toContain("in time");
    expect(locationError(null)).toContain("unavailable");
  });
});
